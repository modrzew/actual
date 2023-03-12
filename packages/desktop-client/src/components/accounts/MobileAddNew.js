import React, { useCallback, useMemo, useState } from 'react';
import { connect } from 'react-redux';
import { useHistory } from 'react-router-dom';

import * as actions from 'loot-core/src/client/actions';
import { useCachedAccounts } from 'loot-core/src/client/data-hooks/accounts';
import { useCachedPayees } from 'loot-core/src/client/data-hooks/payees';
import q, { runQuery } from 'loot-core/src/client/query-helpers';
import { send } from 'loot-core/src/platform/client/fetch';
import { currentDay } from 'loot-core/src/shared/months';
import { realizeTempTransactions } from 'loot-core/src/shared/transactions';
import AccountAutocomplete from 'loot-design/src/components/AccountAutocomplete';
import CategoryAutocomplete from 'loot-design/src/components/CategorySelect';
import { Button, Input, Modal } from 'loot-design/src/components/common';
import { FormField, FormLabel } from 'loot-design/src/components/forms';
import PayeeAutocomplete from 'loot-design/src/components/PayeeAutocomplete';
import View from 'loot-design/src/components/View';
import { colors } from 'loot-design/src/style';

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

  const accounts = useCachedAccounts() || [];
  const payees = useCachedPayees() || [];

  const [payee, setPayee] = useState();
  const [date, setDate] = useState(currentDay());
  const [account, setAccount] = useState();
  const [category, setCategory] = useState();
  const [notes, setNotes] = useState('');
  const [amount, setAmount] = useState('');
  const [isNegative, setIsNegative] = useState(true);

  const accountName =
    account != null ? accounts.find(a => a.id === account)?.name : undefined;
  const categoryName =
    category != null
      ? categoryGroups.flatMap(cg => cg.categories).find(c => c.id === category)
          ?.name
      : undefined;
  const payeeName =
    payee != null ? payees.find(p => p.id === payee)?.name : undefined;

  const [openModal, setOpenModal] = useState('');

  const submit = useCallback(async () => {
    // TODO: error handling
    if (!account) {
      return;
    }
    if (amount == null) {
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
      amount: (isNegative ? -1 : 1) * Number(amount) * 100,
    };

    const transactions = realizeTempTransactions([transaction]);
    await send('transactions-batch-update', {
      added: transactions,
    });

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
        if (account == null) {
          setAccount(lastTransaction.account);
        }
        if (category == null) {
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
          <Input
            type="text"
            readOnly
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
          <Input
            type="text"
            readOnly
            style={inputStyles}
            value={accountName}
            onClick={() => setOpenModal('account')}
          />
        </StyledFormField>
        <StyledFormField>
          <FormLabel title="Category" />
          <Input
            type="text"
            readOnly
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
