export type OpportunityKeyword = {
  keyword: string;
  avgMonthlySearches: number;
  position: number | null;
};

export type OpportunityAssumptions = {
  clickToLeadRate: number;
  closeRate: number;
  averageTicket: number;
  targetCtr: number;
};

export type OpportunityScenario = {
  currentRevenue: number;
  targetRevenue: number;
  opportunityRevenue: number;
  incrementalClicks: number;
  incrementalLeads: number;
  incrementalSales: number;
};

export type OpportunityEstimate = {
  measuredKeywords: number;
  selectedKeywords: number;
  totalMeasuredVolume: number;
  scenarios: {
    conservative: OpportunityScenario;
    likely: OpportunityScenario;
    optimistic: OpportunityScenario;
  };
};

function boundedRate(value: number) {
  return Math.min(Math.max(Number.isFinite(value) ? value : 0, 0), 100);
}

export function ctrForLocalPosition(position: number | null) {
  if (position === null) return null;
  if (position <= 1) return 30;
  if (position <= 2) return 18;
  if (position <= 3) return 12;
  if (position <= 4) return 8;
  if (position <= 5) return 6;
  if (position <= 6) return 5;
  if (position <= 7) return 4.2;
  if (position <= 8) return 3.5;
  if (position <= 9) return 3;
  if (position <= 10) return 2.6;
  if (position <= 15) return 1.4;
  if (position <= 20) return 0.7;
  return 0.3;
}

function calculateScenario(
  keywords: OpportunityKeyword[],
  assumptions: OpportunityAssumptions,
  factors: { targetCtr: number; clickToLead: number; close: number },
): OpportunityScenario {
  const clickToLead = boundedRate(assumptions.clickToLeadRate * factors.clickToLead) / 100;
  const close = boundedRate(assumptions.closeRate * factors.close) / 100;
  const targetCtr = boundedRate(assumptions.targetCtr * factors.targetCtr) / 100;
  const ticket = Math.max(assumptions.averageTicket, 0);

  return keywords.reduce<OpportunityScenario>((total, item) => {
    const currentCtrValue = ctrForLocalPosition(item.position);
    if (currentCtrValue === null) return total;

    const volume = Math.max(item.avgMonthlySearches, 0);
    const currentClicks = volume * (currentCtrValue / 100);
    const targetClicks = volume * targetCtr;
    const incrementalClicks = Math.max(targetClicks - currentClicks, 0);
    const currentSales = currentClicks * clickToLead * close;
    const targetSales = targetClicks * clickToLead * close;
    const incrementalLeads = incrementalClicks * clickToLead;
    const incrementalSales = incrementalLeads * close;

    total.currentRevenue += currentSales * ticket;
    total.targetRevenue += targetSales * ticket;
    total.opportunityRevenue += incrementalSales * ticket;
    total.incrementalClicks += incrementalClicks;
    total.incrementalLeads += incrementalLeads;
    total.incrementalSales += incrementalSales;
    return total;
  }, {
    currentRevenue: 0,
    targetRevenue: 0,
    opportunityRevenue: 0,
    incrementalClicks: 0,
    incrementalLeads: 0,
    incrementalSales: 0,
  });
}

export function estimateKeywordOpportunity(
  keywords: OpportunityKeyword[],
  assumptions: OpportunityAssumptions,
): OpportunityEstimate {
  const measured = keywords.filter(item => item.position !== null);
  return {
    measuredKeywords: measured.length,
    selectedKeywords: keywords.length,
    totalMeasuredVolume: measured.reduce((total, item) => total + Math.max(item.avgMonthlySearches, 0), 0),
    scenarios: {
      conservative: calculateScenario(measured, assumptions, {
        targetCtr: 0.85,
        clickToLead: 0.75,
        close: 0.75,
      }),
      likely: calculateScenario(measured, assumptions, {
        targetCtr: 1,
        clickToLead: 1,
        close: 1,
      }),
      optimistic: calculateScenario(measured, assumptions, {
        targetCtr: 1.15,
        clickToLead: 1.25,
        close: 1.25,
      }),
    },
  };
}
