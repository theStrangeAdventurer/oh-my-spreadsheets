import fs from 'node:fs';
import path from 'node:path';

import dotenv from 'dotenv';

import { Table } from './index';

// Github actions workflow
if (process.env.CI) {
  console.log('cwd', process.cwd());
  fs.writeFileSync(path.join(process.cwd(), '.env'), process.env.ENV!);
}

dotenv.config();

console.log(
  'process.env.GSAPI_CLIENT_PRIVATE_KEY',
  process.env.GSAPI_CLIENT_PRIVATE_KEY,
);

const scheme = { A: 'username', B: 'email' } as const;

const usersTable = new Table(scheme, {
  spreadsheetID: process.env.GSAPI_TABLE_ID!,
  sheet: 'users',
  email: process.env.GSAPI_CLIENT_EMAIL!,
  privateKey: process.env.GSAPI_CLIENT_PRIVATE_KEY!,
});

const TEST_DATA: [string, string?][] = [
  ['userWithoutMail2'],
  ['test', 'testmail@mail.com'],
  ['user2', 'another@mail.com'],
  ['userWithoutMail'],
  ['userololo', 'sssanother@mail.com'],
];

const delay = () => new Promise((resolve) => setTimeout(resolve, 1000));

// Seed table
beforeAll(async () => {
  for (const row of TEST_DATA) {
    const [username, email] = row;
    await usersTable.create({
      data: { username, email: email! },
    });
  }
  expect(await usersTable.count()).toBe(TEST_DATA.length);
});

// Remove all data
afterAll(async () => {
  await usersTable.delete();
  const users = await usersTable.read();

  expect(users.length).toBe(0);
});

beforeEach(async () => {
  await delay();
});

describe('table', () => {
  it('should read data', async () => {
    const all = await usersTable.read();

    expect(all.length).toBe(TEST_DATA.length);

    const users1 = await usersTable.read({
      where: {
        username: 'test',
      },
    });

    expect(users1.length).toBe(1);
    expect(users1[0].email).toBe('testmail@mail.com');
  });

  it('should update data', async () => {
    await usersTable.update({
      where: {
        username: 'test',
      },
      data: {
        email: 'UPDATED',
      },
    });

    const [user] = await usersTable.read({ where: { username: 'test' } });

    expect(user.email).toBe('UPDATED');

    await usersTable.update({
      where: {
        email: 'UPDATED',
      },
      data: {
        username: 'UPDATED',
        email: 'NOT_UPDATED',
      },
    });

    const [_user] = await usersTable.read({ where: { username: 'UPDATED' } });

    expect(_user.email).toBe('NOT_UPDATED');

    // Multiple update
    await usersTable.update({
      where: {
        email: undefined, // empty email
      },
      data: {
        email: 'DEFAULT_EMAIL@MAIL.COM',
      },
    });

    const defaultEmailUsers = await usersTable.read({
      where: { email: 'DEFAULT_EMAIL@MAIL.COM' },
    });

    expect(defaultEmailUsers.length).toBe(2);
    expect(
      defaultEmailUsers.find((u) => u.username === 'userWithoutMail'),
    ).toBeTruthy();
    expect(
      defaultEmailUsers.find((u) => u.username === 'userWithoutMail2'),
    ).toBeTruthy();
  });

  it('should remove user', async () => {
    await usersTable.delete({ where: { username: 'user2' } });
    expect(
      (await usersTable.read({ where: { username: 'user2' } })).length,
    ).toBe(0);
  });

  it('should create user', async () => {
    await usersTable.create({
      data: { username: 'new user', email: 'freshuser@mail.com' },
    });

    const [user] = await usersTable.read({ where: { username: 'new user' } });

    expect(user.username).toBe('new user');
    expect(user.email).toBe('freshuser@mail.com');
  });
});
