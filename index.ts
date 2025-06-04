import http from 'node:http';
import fetch, {Response} from 'node-fetch';
import fetchCookie from 'fetch-cookie';
import { CookieJar } from 'tough-cookie';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import crypto from 'crypto';

interface Tokens {
    access_token: string;
    openId: string;
    userId: string;
    apiuser: string;
    operateId: string;
    language: string;
}

interface UserData {
    authenticatedUser: Record<string, any>;
    userList: Record<string, any>;
}

const port: number = Number(process.env.PORT) || 3000;
const jar = new CookieJar();
const fetchWithCookies = fetchCookie(fetch, jar);

function createSignedPayload(params: Tokens) {
    const data: Record<string, string> = { ...params, timestamp: Math.floor(Date.now() / 1000).toString() };
    
    const sortedKeys = Object.keys(data).sort();

    const encoded = sortedKeys.map(key => `${key}=${encodeURIComponent(data[key])}`).join('&');

    const hmac = crypto.createHmac('sha1', 'mys3cr3t');
    hmac.update(encoded);
    const checkcode = hmac.digest('hex').toUpperCase();

    return {
        payload: encoded,
        checkcode,
        fullPayload: `${encoded}&checkcode=${checkcode}`,
        timestamp: data.timestamp
    };
}

// Step 1: Get nonce value from the login page
async function getNonce(): Promise<string | null> {
    try {
        const getRes = await fetchWithCookies('https://challenge.sunvoy.com/login', {
            headers: {
                'User-Agent': 'Mozilla/5.0',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            }
        }) as Response;

        const html = await getRes.text();
        const dom = new JSDOM(html);
        return (dom.window.document.querySelector('input[name="nonce"]') as HTMLInputElement)?.value || null;

    } catch (err) {
        console.error('Failed to fetch nonce:', err);
        return null;
    }
}

// Step 2: Log in by posting the credentials along with nonce
async function login(nonce: string): Promise<boolean> {
    try {
        const form = new URLSearchParams();
        form.append('username', "demo@example.org");
        form.append('password', "test");
        form.append('nonce', nonce);

        const postRes = await fetchWithCookies('https://challenge.sunvoy.com/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Origin': 'https://challenge.sunvoy.com',
                'Referer': 'https://challenge.sunvoy.com/login',
                'User-Agent': 'Mozilla/5.0'
            },
            body: form,
            redirect: 'manual'
        }) as Response;

        const status = postRes.status;
        const location = postRes.headers.get('location');
        return status === 302 && location === '/list';
    } catch (err) {
        console.error('Login failed:', err);
        return false;
    }
}

// Step 3: Fetch /settings/tokens and extract creds
async function getTokens(): Promise<Tokens | null> {
    try {
        const tokensRes = await fetchWithCookies('https://challenge.sunvoy.com/settings/tokens', {
            headers: {
                'User-Agent': 'Mozilla/5.0',
                'Accept': '*/*',
                'Referer': 'https://challenge.sunvoy.com/settings',
                'Origin': 'https://challenge.sunvoy.com'
            }
        }) as Response;
        
        const tokensHtml = await tokensRes.text();
        const tokenDom = new JSDOM(tokensHtml);

        // extract value by id from the HTML
        const getValueById = (id: string): string => {
            const element = tokenDom.window.document.querySelector(`#${id}`);
            
            if (element instanceof tokenDom.window.HTMLInputElement) {
                return element.value || '';
            }
            
            return '';
        };

        return {
            access_token: getValueById('access_token'),
            openId: getValueById('openId'),
            userId: getValueById('userId'),
            apiuser: getValueById('apiuser'),
            operateId: getValueById('operateId'),
            language: getValueById('language')
        };
    } catch (err) {
        console.error('Failed to fetch tokens:', err);
        return null;
    }
}

// Step 4: Call /api/settings to get authenticated user data
async function getAuthenticatedUserData(signedPayload: { fullPayload: string }): Promise<any | null> {
    try {
        const settingsRes = await fetchWithCookies('https://api.challenge.sunvoy.com/api/settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Origin': 'https://challenge.sunvoy.com',
                'Referer': 'https://challenge.sunvoy.com/',
                'User-Agent': 'Mozilla/5.0',
                'Accept': '*/*'
            },
            body: signedPayload.fullPayload
        }) as Response;  // Cast the response to the standard Response type

        if (settingsRes.status === 200) {
            return await settingsRes.json();  // Using json() to parse the response
        } else {
            console.error(`/api/settings failed. Status: ${settingsRes.status}`);
            return null;
        }
    } catch (err) {
        console.error('Failed to fetch authenticated user data:', err);
        return null;
    }
}

// Step 5: Fetch the list of users from /api/users
async function getUsersList(): Promise<any[] | null> {
    try {
        const apiUsersRes = await fetchWithCookies('https://challenge.sunvoy.com/api/users', {
            method: 'POST',
            headers: {
                'Origin': 'https://challenge.sunvoy.com',
                'Referer': 'https://challenge.sunvoy.com/list',
                'User-Agent': 'Mozilla/5.0',
                'Accept': '*/*'
            }
        }) as Response;  // Cast the response to the standard Response type

        if (apiUsersRes.status === 200) {
            return await apiUsersRes.json();  // Using json() to parse the response
        } else {
            console.error(`Failed to call /api/users. Status: ${apiUsersRes.status}`);
            return null;
        }
    } catch (err) {
        console.error('Failed to fetch users list:', err);
        return null;
    }
}

// Step 6: Combine user data and save to file
async function saveDataToFile(authenticatedUserData: any, usersData: any): Promise<void> {
    try {
        const combinedData: UserData = {
            authenticatedUser: authenticatedUserData,
            userList: usersData
        };

        fs.writeFileSync('user.json', JSON.stringify(combinedData, null, 2), 'utf-8');
        console.log('Data saved to user.json');
        console.log('Process completed successfully.');
    } catch (err) {
        console.error('Failed to save data to file:', err);
    }
}

// Main function to perform all the steps
async function fetchNonceAndLogin(): Promise<void> {
    console.log('Starting the process...');
    try {
        const nonce = await getNonce();
        if (!nonce) return;

        await login(nonce);

        const tokens = await getTokens();
        if (!tokens) return;

        const signedPayload = createSignedPayload(tokens);

        const authenticatedUserData = await getAuthenticatedUserData(signedPayload);
        if (!authenticatedUserData) return;

        const usersData = await getUsersList();
        if (!usersData) return;

        await saveDataToFile(authenticatedUserData, usersData);
    } catch (err) {
        console.error('Unexpected error:', err);
    }
}


// SERVER SETUP
const server = http.createServer((_, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Node.js Sunvoy Challenge Running\n');
});

server.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    fetchNonceAndLogin();
});
