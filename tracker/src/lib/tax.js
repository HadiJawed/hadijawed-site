// Canadian income tax estimate for an employee with only employment income.
// Brackets: 2025 tax year. Update TAX_YEAR and the tables below each January.
// This is an estimate: it ignores most credits and deductions except the basic ones listed.
export const TAX_YEAR = 2025;

// [upper limit of bracket, rate]
const FED = { brackets: [[57375, .145], [114750, .205], [177882, .26], [253414, .29], [Infinity, .33]], bpa: 16129, employment: 1471 };

export const PROVINCES = {
  AB: { name: 'Alberta', bpa: 22323, brackets: [[60000, .08], [151234, .10], [181481, .12], [241974, .13], [362961, .14], [Infinity, .15]] },
  BC: { name: 'British Columbia', bpa: 12932, brackets: [[49279, .0506], [98560, .077], [113158, .105], [137407, .1229], [186306, .147], [259829, .168], [Infinity, .205]] },
  MB: { name: 'Manitoba', bpa: 15780, brackets: [[47000, .108], [100000, .1275], [Infinity, .174]] },
  NB: { name: 'New Brunswick', bpa: 13396, brackets: [[51306, .094], [102614, .14], [190060, .16], [Infinity, .195]] },
  NL: { name: 'Newfoundland and Labrador', bpa: 11067, brackets: [[44192, .087], [88382, .145], [157792, .158], [220910, .178], [282214, .198], [564429, .208], [1128858, .213], [Infinity, .218]] },
  NS: { name: 'Nova Scotia', bpa: 11744, brackets: [[30507, .0879], [61015, .1495], [95883, .1667], [154650, .175], [Infinity, .21]] },
  NT: { name: 'Northwest Territories', bpa: 17842, brackets: [[51964, .059], [103930, .086], [168967, .122], [Infinity, .1405]] },
  NU: { name: 'Nunavut', bpa: 19274, brackets: [[54707, .04], [109413, .07], [177881, .09], [Infinity, .115]] },
  ON: { name: 'Ontario', bpa: 12747, brackets: [[52886, .0505], [105775, .0915], [150000, .1116], [220000, .1216], [Infinity, .1316]] },
  PE: { name: 'Prince Edward Island', bpa: 14250, brackets: [[33328, .095], [64656, .1347], [105000, .166], [140000, .1762], [Infinity, .19]] },
  QC: { name: 'Quebec', bpa: 18571, brackets: [[53255, .14], [106495, .19], [129590, .24], [Infinity, .2575]] },
  SK: { name: 'Saskatchewan', bpa: 19491, brackets: [[53463, .105], [152750, .125], [Infinity, .145]] },
  YT: { name: 'Yukon', bpa: 16129, brackets: [[57375, .064], [114750, .09], [177882, .109], [500000, .128], [Infinity, .15]] }
};

function bracketTax(income, brackets) {
  let tax = 0, lower = 0;
  for (const [upper, rate] of brackets) {
    if (income > lower) tax += (Math.min(income, upper) - lower) * rate;
    lower = upper;
  }
  return tax;
}

function marginal(income, brackets) {
  let lower = 0;
  for (const [upper, rate] of brackets) { if (income <= upper) return rate; lower = upper; }
  return brackets[brackets.length - 1][1] + lower * 0;
}

function payroll(gross, qc) {
  // CPP/QPP base + enhanced (2025), CPP2, EI, QPIP
  const ympe = 71300, yampe = 81200, exempt = 3500;
  const pensionRate = qc ? .064 : .0595;
  const cpp = Math.max(0, Math.min(gross, ympe) - exempt) * pensionRate;
  const cpp2 = Math.max(0, Math.min(gross, yampe) - ympe) * .04;
  const ei = Math.min(gross, 65700) * (qc ? .0131 : .0164);
  const qpip = qc ? Math.min(gross, 98000) * .00494 : 0;
  return { cpp: cpp + cpp2, ei: ei + qpip };
}

export function estimateTax(gross, prov = 'ON') {
  gross = Math.max(0, Number(gross) || 0);
  const P = PROVINCES[prov] || PROVINCES.ON;
  const qc = prov === 'QC';
  const { cpp, ei } = payroll(gross, qc);
  const lowF = FED.brackets[0][1], lowP = P.brackets[0][1];

  let fed = bracketTax(gross, FED.brackets) - (FED.bpa + Math.min(FED.employment, gross) + cpp * .8 + ei) * lowF;
  fed = Math.max(0, fed);
  if (qc) fed *= 1 - .165; // Quebec abatement

  let provTax = Math.max(0, bracketTax(gross, P.brackets) - (P.bpa + cpp * .8 + ei) * lowP);
  if (prov === 'ON') {
    // Ontario surtax and health premium
    provTax += Math.max(0, provTax - 5710) * .2 + Math.max(0, provTax - 7307) * .36;
    provTax += ontarioHealthPremium(gross);
  }

  const total = fed + provTax + cpp + ei;
  const takeHome = gross - total;
  return {
    gross, federal: fed, provincial: provTax, cpp, ei, total, takeHome,
    avgRate: gross ? (fed + provTax) / gross : 0,
    marginal: marginal(gross, FED.brackets) * (qc ? .835 : 1) + marginal(gross, P.brackets),
    province: P.name
  };
}

function ontarioHealthPremium(x) {
  if (x <= 20000) return 0;
  if (x <= 36000) return Math.min(300, (x - 20000) * .06);
  if (x <= 48000) return Math.min(450, 300 + (x - 36000) * .06);
  if (x <= 72000) return Math.min(600, 450 + (x - 48000) * .25);
  if (x <= 200000) return Math.min(750, 600 + (x - 72000) * .25);
  return Math.min(900, 750 + (x - 200000) * .25);
}

// Registered-account limits
export const LIMITS = { tfsaAnnual: 7000, fhsaAnnual: 8000, fhsaLifetime: 40000, rrspMax: 33810, rrspYear: 2026 };
