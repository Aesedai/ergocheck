import bcrypt from 'bcryptjs';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/server/app.js';
import { insertOrg, insertUser } from './db.js';

export const PASSWORD = 'correct horse battery staple';
let hash: string | undefined;

export function testApp(): FastifyInstance {
  return buildApp();
}

/** Creates an org with one admin and one member, both with PASSWORD. */
export async function createOrgWithUsers(name: string) {
  hash ??= await bcrypt.hash(PASSWORD, 4);
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '');
  const orgId = await insertOrg(name);
  const admin = { email: `admin@${slug}.example`, id: await insertUser(orgId, `admin@${slug}.example`, 'org_admin', hash) };
  const member = { email: `member@${slug}.example`, id: await insertUser(orgId, `member@${slug}.example`, 'member', hash) };
  return { orgId, admin, member };
}

/** Logs in and returns the Cookie header value for subsequent requests. */
export async function login(app: FastifyInstance, email: string, password = PASSWORD): Promise<string> {
  const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email, password } });
  if (res.statusCode !== 200) throw new Error(`login failed for ${email}: ${res.statusCode} ${res.body}`);
  const cookie = res.cookies.find((c) => c.name === 'ec_session');
  return `ec_session=${cookie!.value}`;
}
