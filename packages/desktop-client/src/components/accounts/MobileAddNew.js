import React, { useCallback, useMemo, useState } from 'react';
import { connect, useDispatch } from 'react-redux';
import { useHistory } from 'react-router-dom';

import * as actions from 'loot-core/src/client/actions';
import { useCachedAccounts } from 'loot-core/src/client/data-hooks/accounts';
import { useCachedPayees } from 'loot-core/src/client/data-hooks/payees';
import q, { runQuery } from 'loot-core/src/client/query-helpers';
import { send } from 'loot-core/src/platform/client/fetch';
import { currentDay } from 'loot-core/src/shared/months';
import { realizeTempTransactions } from 'loot-core/src/shared/transactions';

import { colors } from '../../style';
import AccountAutocomplete from '../autocomplete/AccountAutocomplete';
import CategoryAutocomplete from '../autocomplete/CategorySelect';
import PayeeAutocomplete from '../autocomplete/PayeeAutocomplete';
import { Button, Input, InputWithContent, Modal, View } from '../common';
import { FormField, FormLabel } from '../forms';

const inputStyles = {
  cursor: 'pointer',
  fontSize: '1.5em',
  padding: '12px 6px',
};

const StyledFormField = ({ children }) => (
  <FormField style={{ margin: '4px 0', flexShrink: 0 }}>{children}</FormField>
);

export function UnconnectedMobileAddNew({ categoryGroups }) {
  const history = useHistory();
  const dispatch = useDispatch();

  const accounts = useCachedAccounts() || [];
  const payees = useCachedPayees() || [];

  const [payee, setPayee] = useState('');
  const [date, setDate] = useState(currentDay());
  const [account, setAccount] = useState('');
  const [category, setCategory] = useState('');
  const [notes, setNotes] = useState('');
  const [amount, setAmount] = useState('');
  const [isNegative, setIsNegative] = useState(true);

  const accountName =
    account !== '' ? accounts.find(a => a.id === account)?.name : '';
  const categoryName =
    category !== ''
      ? categoryGroups.flatMap(cg => cg.categories).find(c => c.id === category)
          ?.name
      : '';
  const payeeName = payee !== '' ? payees.find(p => p.id === payee)?.name : '';

  const [openModal, setOpenModal] = useState('');

  const submit = useCallback(async () => {
    // TODO: error handling
    if (!account) {
      return;
    }
    if (amount === '') {
      return;
    }

    const transaction = {
      id: 'temp',
      date,
      cleared: false,
      notes,
      account,
      payee,
      category,
      // The code below is complex because of floating point math
      amount: Number(((isNegative ? -1 : 1) * Number(amount) * 100).toFixed(0)),
    };

    const transactions = realizeTempTransactions([transaction]);
    await send('transactions-batch-update', {
      added: transactions,
    });

    const categoryBalance = await getCategoryBalance(category);
    const message =
      categoryBalance != null
        ? `Transaction added!\n\n${categoryName} balance: ` +
          (categoryBalance / 100).toFixed(2)
        : 'Transaction added';

    dispatch(
      actions.addNotification({
        type: categoryBalance > 0 ? 'message' : 'warn',
        message,
      }),
    );

    history.push(`/accounts/${account}`);
  });

  const maybeChooseAccountAndCategory = useCallback(
    payeeId => {
      const find = async () => {
        // Find the most recent transaction with this payee
        const result = await runQuery(
          q('transactions')
            .filter({
              payee: payeeId,
            })
            .orderBy({ date: 'desc' })
            .limit(1)
            .select(['category', 'account']),
        );
        if (result.data.length === 0) {
          // This payee was not used in previous transactions
          return;
        }
        const lastTransaction = result.data[0];
        if (account === '') {
          setAccount(lastTransaction.account);
        }
        if (category === '') {
          setCategory(lastTransaction.category);
        }
      };
      find();
    },
    [account, category],
  );

  const modal = useMemo(() => {
    if (!openModal) {
      return null;
    }
    let modal, title;
    switch (openModal) {
      case 'payee':
        title = 'Select payee';
        modal = (
          <PayeeModal
            value={payee}
            onSelect={v => {
              setPayee(v);
              setOpenModal('');
              maybeChooseAccountAndCategory(v);
            }}
          />
        );
        break;
      case 'account':
        title = 'Select account';
        modal = (
          <AccountModal
            value={account}
            onSelect={v => {
              setAccount(v);
              setOpenModal('');
            }}
          />
        );
        break;
      case 'category':
        title = 'Select category';
        modal = (
          <CategoryModal
            categoryGroups={categoryGroups}
            value={category}
            onSelect={v => {
              setCategory(v);
              setOpenModal('');
            }}
          />
        );
        break;
      default:
        throw new Error(`Unhandled modal ${openModal}`);
    }
    return (
      <Modal
        title={title}
        isCurrent={true}
        onClose={() => setOpenModal('')}
        focusAfterClose={false}
        size={{
          height: '95vh',
        }}
      >
        {modal}
      </Modal>
    );
  }, [openModal]);

  return (
    <View style={{ flexGrow: 1 }}>
      {modal}
      <Header isNegative={isNegative} />
      <View style={{ padding: '10px', overflow: 'scroll' }}>
        <StyledFormField>
          <AmountInput
            value={amount}
            onChange={setAmount}
            isNegative={isNegative}
            onSignChange={() => setIsNegative(!isNegative)}
          />
        </StyledFormField>
        <StyledFormField>
          <FormLabel title="Payee" />
          <InputWithContent
            type="text"
            readOnly
            rightContent={
              payee && <Button onClick={() => setPayee('')}>Clear</Button>
            }
            style={inputStyles}
            value={payeeName}
            onClick={() => setOpenModal('payee')}
          />
        </StyledFormField>
        <StyledFormField>
          <FormLabel title="Date" />
          <Input
            type="date"
            style={inputStyles}
            value={date}
            onChange={e => setDate(e.target.value)}
          />
        </StyledFormField>
        <StyledFormField>
          <FormLabel title="Account" />
          <InputWithContent
            type="text"
            readOnly
            rightContent={
              account && <Button onClick={() => setAccount('')}>Clear</Button>
            }
            style={inputStyles}
            value={accountName}
            onClick={() => setOpenModal('account')}
          />
        </StyledFormField>
        <StyledFormField>
          <FormLabel title="Category" />
          <InputWithContent
            type="text"
            readOnly
            rightContent={
              category && <Button onClick={() => setCategory('')}>Clear</Button>
            }
            style={inputStyles}
            value={categoryName}
            onClick={() => setOpenModal('category')}
          />
        </StyledFormField>
        <StyledFormField>
          <FormLabel title="Notes" />
          <Input
            type="text"
            style={{ fontSize: '1.5em', padding: '12px 6px' }}
            onChange={e => setNotes(e.target.value)}
            value={notes}
          />
        </StyledFormField>
        <View style={{ padding: '12px 0' }}>
          <Button onClick={submit} style={inputStyles}>
            Add
          </Button>
        </View>
      </View>
    </View>
  );
}

export const MobileAddNew = connect(
  state => ({
    categoryGroups: state.queries.categories.grouped,
  }),
  actions,
)(UnconnectedMobileAddNew);
export default MobileAddNew;

function AccountModal({ value, onSelect }) {
  return (
    <AccountAutocomplete
      embedded={true}
      value={value}
      onSelect={onSelect}
      groupHeaderStyle={{
        color: colors.n6,
      }}
    />
  );
}

function CategoryModal({ categoryGroups, value, onSelect }) {
  return (
    <CategoryAutocomplete
      embedded={true}
      value={value}
      onSelect={onSelect}
      categoryGroups={categoryGroups}
      groupHeaderStyle={{
        color: colors.n6,
      }}
    />
  );
}

function PayeeModal({ value, onSelect }) {
  return (
    <PayeeAutocomplete
      embedded={true}
      value={value}
      onSelect={onSelect}
      groupHeaderStyle={{
        color: colors.n6,
      }}
    />
  );
}

function Header({ isNegative }) {
  const label = isNegative ? 'Add new expense' : 'Add new deposit';
  return (
    <View
      style={{
        alignItems: 'center',
        backgroundColor: isNegative ? colors.r2 : colors.g2,
        color: 'white',
        flexDirection: 'row',
        flex: '0 0 auto',
        fontSize: 18,
        fontWeight: 500,
        height: 50,
        justifyContent: 'center',
        overflowY: 'auto',
      }}
    >
      {label}
    </View>
  );
}

function AmountInput({ value, onChange, isNegative, onSignChange }) {
  const handleChange = useCallback(
    e => {
      const value = e.target.value;
      if (!isNaN(Number(value))) {
        onChange(value);
      }
    },
    [onChange],
  );
  return (
    <View
      style={{
        flexDirection: 'row',
        flexShrink: '0',
        justifyContent: 'center',
        paddingBottom: '16px',
      }}
    >
      <Button
        onClick={onSignChange}
        style={{
          fontSize: '2em',
          width: '56px',
          marginRight: '8px',
        }}
      >
        {isNegative ? '-' : '+'}
      </Button>
      <Input
        focused={true}
        type="text"
        pattern="[0-9.]*"
        inputMode="numeric"
        onChange={handleChange}
        value={value}
        style={{
          fontSize: '2em',
          width: '50%',
          padding: '12px 6px',
        }}
      />
    </View>
  );
}

async function getCategoryBalance(categoryId) {
  const now = new Date();
  const nowMonth = now.getMonth() + 1;
  const monthWithDash = `${now.getFullYear()}-${
    nowMonth < 10 ? '0' + nowMonth : nowMonth
  }`;
  const monthWithoutDash = monthWithDash.replace('-', '');
  const budget = await send('rollover-budget-month', { month: monthWithDash }); // returns an array of { name, value } objects
  const category = budget.find(
    ({ name }) => name === `budget${monthWithoutDash}!leftover-${categoryId}`,
  );
  return category?.value;
}
