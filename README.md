# Oh my spreadsheets
[![npm version](https://img.shields.io/npm/v/tiny-track)](https://www.npmjs.com/package/oh-my-spreadsheets)

![demo](https://storage.yandexcloud.net/zajtsev-tts/blog/oh-my-spreadsheets-demo.gif)

Easy to use and type-safe library that allows seamless interaction with Google Spreadsheets as if they were a database.
> Tip: Works exceptionally well with TypeScript

## Prerequisites

- To get started, you'll need to obtain a credentials file for your service account, which will be used to interact with your Google Spreadsheet. [link1](https://www.section.io/engineering-education/google-sheets-api-in-nodejs/), [link2](https://thestrangeadventurer.com/kak-ispolzovat-google-sheets-v-kachestve-bazy-dannyh/) (My blog in Russian)

- After that you will need the `client_email` and `private_key` fields from the received file. 

### Env variables

```sh
GSAPI_TABLE_ID="table-id" # https://docs.google.com/spreadsheets/d/<table-id>/edit#gid=0
GSAPI_CLIENT_EMAIL="client_email field from credentials file"
GSAPI_CLIENT_PRIVATE_KEY="private_key field from credentials file"
```

## Quick start

- Install `oh-my-spreadsheets` as a dependency in your project `npm i oh-my-spreadsheets`

- Then, only you need is extend `Table` and specify your table scheme as const (important for typescript checking)

```typescript
import { Table } from "oh-my-spreadsheets";

const userSchema = {
    A: 'username',
    B: 'email'
} as const;

class UsersTable extends Table<typeof userSchema> {}

export const usersTable = new UsersTable(userSchema, {
    tableId: process.env.GSAPI_TABLE_ID!,
    email: process.env.GSAPI_CLIENT_EMAIL!,
    privateKey: process.env.GSAPI_CLIENT_PRIVATE_KEY!,
});

// First, you should init table once
await usersTable.init();

// Receive rows 
const users = await usersTable.list({ limit: 10, offset: 0 });

// Add row
await usersTable.append({
    data: { username: 'test', email: 'asdasd@mail.com' }
})

// Update any rows that have an username with value "test"
await usersTable.remove({
    where: { username: 'test' }
})

// Update any rows that have an empty email field.
await usersTable.update({
    where: { email: '' },
    data: { email: 'supportmail@gmail.com' }
})
```
