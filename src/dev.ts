import dotenv from 'dotenv';

import { Table } from './index';

dotenv.config();

const scheme = { A: 'username', B: 'email' } as const;
class Users extends Table<typeof scheme> {}

const usersTable = new Users(scheme, {
  tableId: process.env.GSAPI_TABLE_ID!,
  email: process.env.GSAPI_CLIENT_EMAIL!,
  privateKey: process.env.GSAPI_CLIENT_PRIVATE_KEY!,
});

async function main() {
  await usersTable.init();
  const users = await usersTable.list();

  // await usersTable.update({
  //   where: { email: 'none' },
  //   data: { username: 'king', email: 'awesome@gmail.com' },
  // });

  // await usersTable.append({
  //   data: {
  //     email: 'awesomeNewuser@gmail.com',
  //     username: 'newUser',
  //   },
  // });

  await usersTable.remove({ where: { email: 'awesomewmail@mail.com' } });
}

void main();
