import React from 'react';

import { useCachedAccounts } from 'loot-core/src/client/data-hooks/accounts';
import { useCachedPayees } from 'loot-core/src/client/data-hooks/payees';
import View from 'loot-design/src/components/View';

export default function MobileAddNew() {
  const accounts = useCachedAccounts() || [];
  const payees = useCachedPayees() || [];
  return (
    <View>
      <h1>Add new transaction</h1>
      <p>Account</p>
      <select>
        <option disabled selected>
          Select an account
        </option>
        {accounts.map(acc => (
          <option key={acc.id} value={acc.id}>
            {acc.name}
          </option>
        ))}
      </select>
      <p>Payee</p>
      <select>
        <option disabled selected>
          Select a payee
        </option>
        {payees.map(payee => (
          <option key={payee.id} value={payee.id}>
            {payee.name}
          </option>
        ))}
        <option>--- Add new</option>
      </select>
      <p>Note</p>
      <input type="text" />
      <p>Amount</p>
      <input type="text" />
      <button>Add</button>
    </View>
  );
}
