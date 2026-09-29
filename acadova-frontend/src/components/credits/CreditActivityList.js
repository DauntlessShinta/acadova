import React from 'react';

const h = React.createElement;

export const CreditActivityList = ({ history }) => {
  if (history.length === 0) {
    return h('div', { className: 'empty-state' },
      h('h3', null, 'No credit activity yet'),
      h('p', null, 'Your starting credits and completed tutoring sessions will appear here.'));
  }
  return h('ul', { className: 'credit-activity-list', 'aria-label': 'Credit activity' },
    history.map((tx) => {
      const direction = ['earned', 'spent'].includes(tx.direction) ? tx.direction : 'neutral';
      const date = tx.occurredAt && !Number.isNaN(Date.parse(tx.occurredAt))
        ? new Date(tx.occurredAt).toLocaleDateString() : 'Date unavailable';
      return h('li', { className: 'credit-activity', key: tx.id },
        h('div', { className: 'credit-activity-main' },
          h('strong', null, tx.label || 'Credit activity'),
          tx.description ? h('span', null, tx.description)
            : tx.relatedSession?.subject ? h('span', null, tx.relatedSession.subject)
              : tx.counterparty ? h('span', null, `With ${tx.counterparty}`) : null,
          h('time', { dateTime: tx.occurredAt || undefined }, date)),
        h('div', { className: `credit-activity-amount credit-activity-${direction}` },
          h('strong', null, tx.amount == null ? 'Amount unavailable'
            : `${direction === 'earned' ? '+' : direction === 'spent' ? '−' : ''}${tx.amount} credits`),
          h('span', null, direction === 'neutral' ? 'Activity' : direction === 'earned' ? 'Earned' : 'Spent')));
    }));
};

export default CreditActivityList;
