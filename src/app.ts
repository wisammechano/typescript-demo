import express, { NextFunction, Request, Response } from 'express';
import * as dotenv from 'dotenv';
dotenv.config();
import cookieParser from 'cookie-parser'; // Express middleware for parsing cookie header and signing cookies. The parsed cookie is available as req.cookies.
import setupPassport from './passport-setup';

import apiRoutes from './routes';

import db from './db';
import jwt from 'express-jwt';

let jwtMiddleware = jwt({
  secret: process.env['SECRET_KEY'] ?? '', // secret key is always required
  algorithms: ['HS256'], // encryption algorithm is always required
  requestProperty: 'auth', // This ensures that decoded token details will be available on req.auth else req.user is the default.
  getToken: (req: Request) => req.cookies['_t'],
}).unless({ path: /google/ });

const port = 4000;

db.connect().then(() => {
  console.info('Connected to db');
});

const app = express();

app.use(express.json());
app.use(setupPassport());
// Let Express app use cookie middlewares with secret key for handling encryption of cookies
app.use(cookieParser(process.env['SECRET_KEY']));
app.use('/api', jwtMiddleware, apiRoutes);

// Let Express app use a middleware function that sends 401 error response code for auth errors and 500 for others
app.use(ErrorHandler);

// Let Express app use configured and initialized PassportJS middleware

if (process.env['NODE_ENV'] !== 'test') {
  app.listen(port, () => {
    console.log(`API Server started on port ${port}`);
  });
}

// This function will handle all errors and send appropriate response code
function ErrorHandler(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err.name === 'UnauthorizedError') {
    res
      .status(401)
      .json({ error: true, message: `Invalid Token: ${err.message}` });
  } else {
    console.log(err);
    res
      .status(500)
      .json({ error: true, message: 'Internal server error occured' });
  }
}

module.exports = app;
