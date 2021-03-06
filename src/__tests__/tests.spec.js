// const mongoose = require('mongoose');
const db = require('../db');
const app = require('../app');
const req = require('supertest')(app);
const monkeypatch = require('monkeypatch');
const http = require('node:http');
const https = require('node:https');
const supertest = require('supertest');
const mongoose = require('mongoose');

jest.setTimeout(4500);

const URL_REGEX =
  /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}(\.[a-zA-Z0-9()]{1,6})?\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/;

const mockUser = {
  sub: '12345678',
  name: 'John Doe',
  given_name: 'John',
  family_name: 'Doe',
  picture: 'https://lh3.googleusercontent.com/a-/AOh1',
  email: 'john.doe@gmail.com',
  email_verified: true,
  locale: 'en-GB',
};

beforeAll(async () => {
  await db.connect();
});

afterAll(async () => {
  await db.closeDatabase();
});

let redirectUri = null;

describe('Auth Endpoints', () => {
  let cookiesAgent = supertest.agent(app);

  afterAll(async () => {
    await db.clearDatabase();
  });

  describe('GET /api/auth/google', () => {
    it('Redirects to google authorization page', (done) => {
      req
        .get('/api/auth/google')
        .expect(302)
        .expect('location', /google\.com/)
        .end(done);
    });

    it('Redirects with correct scope and credentials', async () => {
      const res = await req.get('/api/auth/google');
      const location = res.header['location'];

      expect(location).not.toBeNull();

      const uri = new URL(location);
      const scope = uri.searchParams.get('scope')?.split(' ') ?? [];
      const redirectTo = uri.searchParams.get('redirect_uri') ?? '';
      const client_id = uri.searchParams.get('client_id') ?? '';

      expect(scope).toEqual(
        expect.arrayContaining(['openid', 'email', 'profile'])
      );
      expect(redirectTo).toMatch(URL_REGEX);
      expect(client_id.length).toBeGreaterThan(10);

      if (redirectTo) redirectUri = new URL(redirectTo);
    });
  });

  describe(`GET REDIRECT_URI`, () => {
    it('Redirects to home without cookie for incorrect credentials', async () => {
      expect(redirectUri).not.toBeNull();
      const res = await req.get(redirectUri.pathname);
      expect(res.status).toBe(302);
      expect(res.header['set-cookie']).not.toBeDefined();
    });

    it('Redirects to home with a valid JWT cookie for correct credentials', async () => {
      expect(redirectUri).not.toBeNull();

      const res = await runInPatchedServer(
        async () => await cookiesAgent.get(getLoginURL(redirectUri.pathname))
      );

      expect(res.status).toBe(302);
      expect(res.header['set-cookie']).toBeDefined();

      const [cookies] = parseCookies(res.header['set-cookie']);

      const auth_cookie = getJWTCookie(cookies);

      const iat = auth_cookie.iat;

      expect(iat).toBeLessThanOrEqual(Date.now() / 1000);

      const expected = {
        name: mockUser.name,
        email: mockUser.email,
        providerId: `google-${mockUser.sub}`,
        avatar: mockUser.picture,
        exp: iat + 14 * 24 * 3600,
        iat: expect.any(Number),
      };

      expect(auth_cookie).toEqual(expect.objectContaining(expected));
    });
  });

  describe('GET /api/auth/me', () => {
    it('It responds with a user schema json correctly for valid token', async () => {
      const res = await cookiesAgent.get('/api/auth/me');

      expect(res.status).toBe(200);
      const expected = {
        name: expect.any(String),
        email: expect.any(String),
        avatar: expect.any(String),
      };
      expect(res.body).toEqual(expect.objectContaining(expected));
    });

    it('It responds with 401 for invalid token', async () => {
      const res = await req.get('/api/auth/me');

      expect(res.status).toBe(401);
      const notExpected = {
        name: expect.any(String),
        email: expect.any(String),
        avatar: expect.any(String),
      };

      expect(res.body).not.toEqual(expect.objectContaining(notExpected));
    });
  });

  describe('GET /api/auth/logout', () => {
    it('Clears the auth cookie and responds with 200', async () => {
      const resLogout = await cookiesAgent.get('/api/auth/logout');
      const resLoggedIn = await cookiesAgent.get('/api/auth/me');

      expect(resLogout.status).toBe(200);
      expect(resLoggedIn.status).toBe(401);
    });
  });
});

describe('Todo Endpoints', () => {
  describe('When not authenticated', () => {
    it('Responds with 401 for all endpoints', async () => {
      const resRead = await req.get('/api/todos');
      const resCreate = await req
        .post('/api/todos')
        .send({ text: 'test_todo' });
      const resUpdate = await req
        .put('/api/todos/dsds')
        .send({ text: 'Update_test' });
      const resDelete = await req.delete('/api/todos/dsds');

      expect(resRead.status).toBe(401);
      expect(resCreate.status).toBe(401);
      expect(resUpdate.status).toBe(401);
      expect(resDelete.status).toBe(401);
    });
  });

  describe('When authenticated', () => {
    let todoID = null;
    let anotherTodoID = null;
    let agent = supertest.agent(app);
    const Todo = require('../models/Todo');

    const mockTodo = {
      text: 'Test Todo Mock',
    };

    beforeAll(async () => {
      await runInPatchedServer(
        async () => await agent.get(getLoginURL(redirectUri.pathname))
      );

      const anotherTodo = await Todo.create({
        text: 'Testing',
        user: mongoose.Types.ObjectId('abcdresseaes'),
        done: false,
      });

      anotherTodoID = anotherTodo['_id'];
    });

    it('Correctly create new todos for this user', async () => {
      const res = await agent.post('/api/todos').send(mockTodo);

      expect(res.status).toBe(201);
      expect(res.body).toEqual(
        expect.objectContaining({
          text: mockTodo.text,
          done: false,
          id: expect.any(String),
        })
      );

      todoID = res.body.id;
    });

    it('Correctly update a todo for this user', async () => {
      const res = await agent.put(`/api/todos/${todoID}`).send({ done: true });
      expect(res.status).toBe(200);
      expect(res.body).toEqual(
        expect.objectContaining({
          text: mockTodo.text,
          done: true,
          id: todoID,
        })
      );
    });

    it('Prevents updating todos for other users', async () => {
      const res = await agent
        .put(`/api/todos/${anotherTodoID}`)
        .send({ done: true });
      expect(res.status).toBe(401);

      const todo = await Todo.findById(anotherTodoID);
      expect(todo.done).toBe(false);
    });

    it('Correctly read todos for this user', async () => {
      const res = await agent.get('/api/todos');

      expect(res.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            text: mockTodo.text,
            done: true,
          }),
        ])
      );

      expect(res.body.length).toBe(1);
    });

    it('Correctly delete todos for this user', async () => {
      const res = await agent.delete(`/api/todos/${todoID}`);

      expect(res.status).toBe(204);

      const todo = await Todo.findById(todoID);

      expect(todo).toBeNull();
    });

    it('Prevent deleting todos for other users', async () => {
      const res = await agent.delete(`/api/todos/${anotherTodoID}`);

      expect(res.status).toBe(401);

      const todo = await Todo.findById(anotherTodoID);
      expect(todo).not.toBeNull();
    });
  });
});

// Util functions

// This function is used to mock requests to google API
// It will intercept any call to google,
// and responds with mocked userProfile and access token

async function runInPatchedServer(cb) {
  const undo = patch__google_request({
    [`http://127.0.0.1/token`]: (path) => path.endsWith('token'),
    [`http://127.0.0.1/userinfo`]: (path) => path.endsWith('userinfo'),
  });

  let shutdownServer = runTestServer();

  const ret = await cb();

  shutdownServer();
  undo();

  return ret;
}

function patch__google_request(redirects, debug = false) {
  monkeypatch(https, 'request', (orig, opts, cb) => {
    const { host, path } = opts;

    if (/google[a-z0-9]*\.com/.test(host)) {
      if (debug)
        console.log(
          'Intercepted google call to: ',
          opts.method ?? 'GET',
          opts.host,
          opts.path
        );

      for (let url of Object.keys(redirects)) {
        const matcher = redirects[url];
        url = new URL(url);
        if (matcher(path.split('?')[0])) {
          if (debug) console.log('Redirecting to test server: ', url.href);
          opts['host'] = url.host;
          opts['port'] = 5005;
          opts['path'] = url.pathname;
          opts['headers']['Host'] = url.origin;

          return http.request(opts, cb);
        }
      }
    }
    return orig(opts, cb);
  });

  return () => {
    https.request.unpatch();
  };
}

function getLoginURL(base) {
  const params = Object.entries({
    code: 'TEST_CODE',
    scope: 'email profile openid',
  }).reduce((a, p) => {
    a.append(...p);
    return a;
  }, new URLSearchParams());

  return `${base}?${params.toString()}`;
}

// This is a testing server that
// serves google identical profile and tokens
function runTestServer() {
  const app = require('express')();
  const token = {
    access_token: 'TEST_ACCESS_TOKEN',
  };

  app.get('/token', (req, res) => {
    res.json(token);
  });

  app.post('/token', (req, res) => {
    res.json(token);
  });

  app.get('/userinfo', (req, res) => {
    res.json(mockUser);
  });

  const server = app.listen(5005, () => {});

  return async () => await server.close();
}

// receives cookies object {name: value}
function getJWTCookie(cookies) {
  const entries = Object.entries(cookies);

  for (let [, value] of entries) {
    try {
      value = parseJWTCookie(value);
      return value;
    } catch (err) {
      continue;
    }
  }
}
function parseJWTCookie(value) {
  if (typeof value !== 'string') {
    return undefined;
  }
  const { SECRET_KEY } = process.env;

  const { decryptAesGcm } = require('encrypt-cookie');
  const jwt = require('jsonwebtoken');
  value = decryptAesGcm(value, SECRET_KEY) || value;

  if (value.substr(0, 2) === 's:') {
    // Unsign cookie
    const { unsign } = require('cookie-signature');
    value = unsign(value, SECRET_KEY);
  }

  const decoded = jwt.verify(value, SECRET_KEY);
  return decoded;
}

// parses set-cookie array
function parseCookies(cookies) {
  const parser = require('cookie');
  const obj = {};
  cookies.forEach((c) => {
    try {
      c = parser.parse(c.split(/; */)[0]);
      Object.assign(obj, c);
    } catch (err) {
      console.log(err);
    }
  });
  return [
    obj,
    Object.entries(obj)
      .map((e) => parser.serialize(...e))
      .join('; '),
  ];
}
