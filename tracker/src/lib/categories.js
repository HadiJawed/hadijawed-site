// Categories per kind of money movement. Icons are emoji so they read instantly on a phone.
export const CATS = {
  expense: [
    ['Housing', '🏠'], ['Groceries', '🛒'], ['Eating out', '🍔'], ['Transport', '🚌'], ['Bills', '💡'],
    ['Subscriptions', '📺'], ['Shopping', '🛍️'], ['Health', '💊'], ['Fun', '🎉'], ['Travel', '✈️'],
    ['Education', '📚'], ['Gifts', '🎁'], ['Personal care', '💈'], ['Kids', '🧸'], ['Pets', '🐾'], ['Other', '📦']
  ],
  income: [['Paycheque', '💼'], ['Side hustle', '🛠️'], ['Freelance', '💻'], ['Bonus', '⭐'], ['Rental', '🏘️'], ['Gift', '🎁'], ['Refund', '↩️'], ['Other', '💵']],
  invest: [['TFSA', '🌱'], ['RRSP', '🏦'], ['FHSA', '🔑'], ['Emergency fund', '🛟'], ['Stocks / ETFs', '📈'], ['Crypto', '🪙'], ['RESP', '🎓'], ['Other', '💰']]
};

export const KINDS = {
  expense: { label: 'Spent', verb: 'Expense', color: 'var(--coral)' },
  income: { label: 'Earned', verb: 'Income', color: 'var(--green)' },
  invest: { label: 'Invested', verb: 'Invest', color: 'var(--cobalt)' }
};

export const icon = (kind, cat) => (CATS[kind] || []).find(c => c[0] === cat)?.[1] || (kind === 'income' ? '💵' : kind === 'invest' ? '💰' : '📦');

// Distinct, harmonious colours for charts (cobalt family + warm accents)
export const PALETTE = ['#2438F0', '#FF5A45', '#FFB020', '#13A877', '#8B5CF6', '#EC4899', '#0EA5E9', '#F97316', '#64748B', '#A3A80F', '#14B8A6', '#9F1239'];
