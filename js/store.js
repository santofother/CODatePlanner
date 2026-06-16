// js/store.js — Peak Dates data layer
//
// A single, swappable persistence interface. The LocalStore implementation
// below keeps everything in localStorage so the app runs with zero backend.
//
// To move to Supabase, implement a SupabaseStore with the SAME methods and
// export it when CONFIG.BACKEND === 'supabase'. The rest of the app only
// talks to `store`, never to localStorage or Supabase directly.
//
// Interface (all async to keep the Supabase swap painless):
//   auth:    currentUser(), signUp(), signIn(), signOut()
//   profile: getProfile(id), saveProfile(p), getPartner(profile)
//   survey:  getSurvey(userId), saveSurvey(userId, data)
//   catalog: getCatalog()
//   couple:  getCoupleDates(coupleId), setStatus(...), saveReview(...)
//   rotation:getRotation(coupleId, weekStart), saveRotation(...)

import { CONFIG } from './config.js';
import { SEED_DATES } from './seed.js';

const KEY = 'peakdates.v1';

function uid(prefix = 'u') {
  return prefix + '-' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
}
function inviteCode() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// coupleId is a stable, order-independent key derived from both partner ids.
export function coupleIdFor(idA, idB) {
  return [idA, idB].filter(Boolean).sort().join('__');
}

class LocalStore {
  constructor() {
    this.db = this._load();
  }
  _load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* fall through to fresh db */ }
    return { users: {}, profiles: {}, surveys: {}, coupleDates: {}, rotations: {}, sessionUserId: null };
  }
  _save() { localStorage.setItem(KEY, JSON.stringify(this.db)); }

  // ── Auth (local, password stored plain — demo only; Supabase handles real auth) ──
  async currentUser() {
    const id = this.db.sessionUserId;
    return id && this.db.profiles[id] ? this.db.profiles[id] : null;
  }
  async signUp({ email, password, displayName }) {
    const existing = Object.values(this.db.users).find(u => u.email === email.toLowerCase());
    if (existing) throw new Error('That email is already on the trail. Try signing in.');
    const id = uid('p');
    this.db.users[id] = { id, email: email.toLowerCase(), password };
    this.db.profiles[id] = {
      id, email: email.toLowerCase(),
      display_name: displayName || email.split('@')[0],
      partner_id: null, partner_invite_code: inviteCode(),
      avatar_emoji: '🏔️', created_at: new Date().toISOString(),
      onboarded: false,
    };
    this.db.sessionUserId = id;
    this._save();
    return this.db.profiles[id];
  }
  async signIn({ email, password }) {
    const user = Object.values(this.db.users).find(u => u.email === email.toLowerCase());
    if (!user || user.password !== password) throw new Error("Those credentials didn't summit. Check and try again.");
    this.db.sessionUserId = user.id;
    this._save();
    return this.db.profiles[user.id];
  }
  async signOut() { this.db.sessionUserId = null; this._save(); }

  // ── Demo seed: create a ready-to-explore couple so visitors can try it ──
  async seedDemoCouple() {
    const aId = uid('p'), bId = uid('p');
    const code = inviteCode();
    this.db.users[aId] = { id: aId, email: 'demo@peakdates.app', password: 'demo' };
    this.db.users[bId] = { id: bId, email: 'partner@peakdates.app', password: 'demo' };
    this.db.profiles[aId] = { id: aId, email: 'demo@peakdates.app', display_name: 'Alex', partner_id: bId, partner_invite_code: code, avatar_emoji: '🏔️', created_at: new Date().toISOString(), onboarded: true, couple_name: 'The Trailblazers' };
    this.db.profiles[bId] = { id: bId, email: 'partner@peakdates.app', display_name: 'Sam', partner_id: aId, partner_invite_code: inviteCode(), avatar_emoji: '🌲', created_at: new Date().toISOString(), onboarded: true };
    this.db.surveys[aId] = { user_id: aId, outdoorsy_score: 8, activity_level: 7, budget_range: 5, spontaneity: 6, social_vibe: 4, distance_tolerance: 7, favorite_categories: ['mountain', 'brewery', 'chill'], dietary_notes: 'Veggie-friendly please', mobility_notes: '', has_car: true, location_pref: 'south-denver', distance_miles: 90, updated_at: new Date().toISOString() };
    this.db.surveys[bId] = { user_id: bId, outdoorsy_score: 6, activity_level: 5, budget_range: 6, spontaneity: 4, social_vibe: 6, distance_tolerance: 6, favorite_categories: ['brewery', 'culture', 'city'], dietary_notes: '', mobility_notes: '', has_car: true, location_pref: 'south-denver', distance_miles: 90, updated_at: new Date().toISOString() };
    this.db.sessionUserId = aId;
    this._save();
    return this.db.profiles[aId];
  }

  // ── Profiles ──
  async getProfile(id) { return this.db.profiles[id] || null; }
  async saveProfile(p) { this.db.profiles[p.id] = { ...this.db.profiles[p.id], ...p }; this._save(); return this.db.profiles[p.id]; }
  async getPartner(profile) { return profile && profile.partner_id ? this.db.profiles[profile.partner_id] : null; }

  async linkPartnerByCode(myId, code) {
    const partner = Object.values(this.db.profiles).find(p => p.partner_invite_code === code.toUpperCase() && p.id !== myId);
    if (!partner) throw new Error("No trail buddy found for that code. Double-check it?");
    this.db.profiles[myId].partner_id = partner.id;
    this.db.profiles[partner.id].partner_id = myId;
    this._save();
    return partner;
  }

  // ── Surveys ──
  async getSurvey(userId) { return this.db.surveys[userId] || null; }
  async saveSurvey(userId, data) {
    this.db.surveys[userId] = { ...this.db.surveys[userId], user_id: userId, ...data, updated_at: new Date().toISOString() };
    this._save();
    return this.db.surveys[userId];
  }

  // ── Catalog ──
  async getCatalog() { return SEED_DATES; }
  async getDate(id) { return SEED_DATES.find(d => d.id === id) || null; }

  // ── Couple dates (status + reviews) ──
  async getCoupleDates(coupleId) {
    return Object.values(this.db.coupleDates).filter(cd => cd.couple_id === coupleId);
  }
  async getCoupleDate(coupleId, dateId) {
    return Object.values(this.db.coupleDates).find(cd => cd.couple_id === coupleId && cd.date_catalog_id === dateId) || null;
  }
  async setStatus(coupleId, dateId, status, extra = {}) {
    let rec = await this.getCoupleDate(coupleId, dateId);
    if (!rec) {
      rec = { id: uid('cd'), couple_id: coupleId, date_catalog_id: dateId, suggested_at: new Date().toISOString() };
      this.db.coupleDates[rec.id] = rec;
    }
    rec.status = status;
    if (status === 'pinned') rec.pinned_at = new Date().toISOString();
    if (status === 'done') rec.completed_at = rec.completed_at || new Date().toISOString();
    Object.assign(rec, extra);
    this._save();
    return rec;
  }
  async saveReview(coupleId, dateId, review) {
    const rec = await this.setStatus(coupleId, dateId, 'done');
    Object.assign(rec, review, { review_submitted_at: new Date().toISOString() });
    this._save();
    return rec;
  }

  // ── Weekly rotation ──
  async getRotation(coupleId, weekStart) {
    return Object.values(this.db.rotations).find(r => r.couple_id === coupleId && r.week_start === weekStart) || null;
  }
  async saveRotation(coupleId, weekStart, dateIds) {
    const existing = await this.getRotation(coupleId, weekStart);
    const rec = existing || { id: uid('wr'), couple_id: coupleId, week_start: weekStart };
    rec.date_ids = dateIds;
    rec.generated_at = new Date().toISOString();
    this.db.rotations[rec.id] = rec;
    this._save();
    return rec;
  }
  async countRotations(coupleId) {
    return Object.values(this.db.rotations).filter(r => r.couple_id === coupleId).length;
  }

  // dev helper
  async wipe() { localStorage.removeItem(KEY); this.db = this._load(); }
}

// Future: class SupabaseStore { ... same interface, backed by supabase-js ... }

export const store = CONFIG.BACKEND === 'supabase'
  ? (() => { throw new Error('SupabaseStore not yet implemented — see js/store.js. Set BACKEND back to "local".'); })()
  : new LocalStore();
