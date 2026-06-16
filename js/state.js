// js/state.js — in-memory app session context, loaded once per navigation.

import { store, coupleIdFor } from './store.js';
import { blendSurveys, preferenceWeights } from './algorithm.js';

// localStorage survey key for a partner who isn't a linked account but whose
// answers one person filled out (the "both, separately" / "combined" flows).
export function partnerSurveyKey(userId) { return userId + ':partner'; }

export const session = {
  user: null,
  partner: null,
  partnerName: null,
  coupleId: null,
  survey: null,
  partnerSurvey: null,
  pref: null,
  catalog: [],
  coupleDates: [],
  weights: {},
};

// Reload everything about the current logged-in couple.
export async function loadSession() {
  const user = await store.currentUser();
  session.user = user;
  if (!user) { session.partner = null; return session; }

  session.partner = await store.getPartner(user);
  session.coupleId = coupleIdFor(user.id, user.partner_id);
  session.survey = await store.getSurvey(user.id);
  if (session.partner) {
    session.partnerSurvey = await store.getSurvey(session.partner.id);
    session.partnerName = session.partner.display_name;
  } else {
    // No linked account — fall back to a self-filled partner survey, if any.
    session.partnerSurvey = await store.getSurvey(partnerSurveyKey(user.id));
    session.partnerName = session.partnerSurvey ? (user.partner_label || 'Partner') : null;
  }
  session.pref = blendSurveys(session.survey, session.partnerSurvey);
  session.catalog = await store.getCatalog();
  session.coupleDates = await store.getCoupleDates(session.coupleId);
  session.weights = preferenceWeights(session.coupleDates, session.catalog);
  return session;
}

// Map of dateId → status for the current couple.
export function statusMap() {
  const m = {};
  for (const cd of session.coupleDates) m[cd.date_catalog_id] = cd.status;
  return m;
}

export function coupleDateFor(dateId) {
  return session.coupleDates.find(cd => cd.date_catalog_id === dateId) || null;
}

export async function refreshCoupleDates() {
  session.coupleDates = await store.getCoupleDates(session.coupleId);
  session.weights = preferenceWeights(session.coupleDates, session.catalog);
}
