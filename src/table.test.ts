import dotenv from 'dotenv';

import { Table } from './index';

dotenv.config();

const scheme = { A: 'id', B: 'username', C: 'email', D: 'last_col' } as const;

const usersTable = new Table(scheme, {
  spreadsheetID: process.env.GSAPI_TABLE_ID!,
  sheet: 'users',
  email: process.env.GSAPI_CLIENT_EMAIL!,
  privateKey: process.env.GSAPI_CLIENT_PRIVATE_KEY!,
});

const TEST_DATA: [string?, string?, string?][] = [
  ['userWithoutMail2'],
  ['test', 'testmail@mail.com'],
  ['user2', 'another@mail.com'],
  ['userWithoutMail'],
  ['userololo', 'sssanother@mail.com'],
  [undefined, 'nouser@name.email'],
];

const delay = () => new Promise((resolve) => setTimeout(resolve, 1000));

// Seed table
beforeAll(async () => {
  // so you can see the data after tests run
  await usersTable.deleteTable();
  await usersTable.createTable();
  let id = 1;
  for (const row of TEST_DATA) {
    const [username, email, lastCol] = row;
    await usersTable.create({
      data: {
        id: String(id),
        username: username!,
        email: email!,
        last_col: lastCol!,
      },
    });
    id += 1;
  }
  expect(await usersTable.count()).toBe(TEST_DATA.length);
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

  it('should update when last column undefined/empty', async () => {
    const [noUserName] = await usersTable.read({
      where: {
        email: 'nouser@name.email',
      },
    });

    expect(noUserName.last_col).toBe(undefined);

    await usersTable.update({
      where: {
        email: 'nouser@name.email',
      },
      data: {
        last_col: 'UPDATED',
      },
    });

    const [noUserNameNow] = await usersTable.read({
      where: {
        email: 'nouser@name.email',
      },
    });

    expect(noUserNameNow.last_col).toBe('UPDATED');
  });

  it('should remove user', async () => {
    await usersTable.delete({ where: { username: 'user2' } });
    expect(
      (await usersTable.read({ where: { username: 'user2' } })).length,
    ).toBe(0);
  });

  it('should create user', async () => {
    await usersTable.create({
      data: {
        id: String(432),
        username: 'new user',
        email: 'freshuser@mail.com',
        last_col: 'pew pew',
      },
    });

    const [user] = await usersTable.read({ where: { username: 'new user' } });

    expect(user.username).toBe('new user');
    expect(user.email).toBe('freshuser@mail.com');
  });

  it('should create users', async () => {
    await usersTable.create({
      data: [
        {
          id: String(543),
          username: 'new user1',
          email: 'user1@mail.com',
          last_col: 'pew pew1',
        },
        {
          id: String(654),
          username: 'new user2',
          email: 'user2@mail.com',
          last_col: 'pew pew2',
        },
      ],
    });

    const [user1] = await usersTable.read({ where: { username: 'new user1' } });
    const [user2] = await usersTable.read({ where: { username: 'new user2' } });

    expect(user1.username).toBe('new user1');
    expect(user1.email).toBe('user1@mail.com');
    expect(user2.username).toBe('new user2');
    expect(user2.email).toBe('user2@mail.com');
  });
});
