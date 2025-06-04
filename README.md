# Node.js Sunvoy Challenge

## 🎥 Loom Video LINK https://www.loom.com/share/d6a5c75ceabd42dab5228c4bd70e6122?sid=515914ef-39bb-4eb0-9739-b72490751352


## Overview
This Node.js script automates the process of logging into the `challenge.sunvoy.com` website, fetching user data, and saving it to a local JSON file (`user.json`). The script follows these steps:

1. **Fetch Nonce**: The script fetches the nonce required for login from the login page.
2. **Login**: Uses the fetched nonce to log in to the site with the provided credentials.
3. **Fetch Tokens**: After logging in, it retrieves the tokens required for making authenticated API requests.
4. **Fetch User Data**: Fetches the list of users from `/api/users`.
5. **Save Data**: Saves the authenticated user data and the list of users to a `user.json` file.

## Prerequisites

Make sure you have the following installed:

- [Node.js](https://nodejs.org/en/) (>=14.0.0)
- [npm](https://www.npmjs.com/get-npm) (Node package manager)

## Dependencies

This project requires the following npm packages:

- `node-fetch`: A lightweight module for making HTTP requests.
- `fetch-cookie`: A module that adds cookie support to `node-fetch`.
- `tough-cookie`: A cookie jar implementation for use with `fetch-cookie`.
- `jsdom`: A module that simulates a web browser environment for parsing HTML documents.
- `crypto`: Node's built-in library for creating cryptographic hash functions (HMAC).

Install these dependencies by running the following command:

```bash
npm install
```

Run the script:

```bash
npm run start