const passport = require('passport'); // PassportJS middleware
const GoogleStrategy = require('passport-google-oauth20').Strategy; // PassportJS Google OAuth 2.0 strategy
const User = require('./models/user');

// Prepare Google Auth handling configuration
const googleConfigs = {
  clientID: 'SomeClientID',
  clientSecret: 'SomeClientSecret',
  callbackURL: 'http://localhost:4000/api/auth/google/callback',
};

const afterGoogleSignin = async (accessToken, refreshToken, profile, cb) => {
  // In some cases it might be required to save user's access token and refresh token which are returned to us by Google.
  // For this assignment, we will not worry about these tokens.
  try {
    let user = await User.findOne({ providerId: `google-${profile.id}` });
    if (!user) {
      user = await createGoogleUser(profile);
    }

    cb(null, user.toJSON());
  } catch (err) {
    cb(err, null);
  }
};

async function createGoogleUser(profile) {
  // Search if logged in user exists in the database
  // If user doesn't exist, create the user record on the database
  // In creating user record we use values shared by Google with us such as email, name, picture, etc.
  const user = await User.create({
    email: profile.emails?.shift().value,
    name: profile.displayName,
    firstname: profile.name?.givenName,
    lastname: profile.name?.familyName,
    profilePicture: profile.photos?.shift().value,
    provider: 'google',
    providerId: `google-${profile.id}`,
  });

  return user;
}

function initGooglePassport() {
  const strategy = new GoogleStrategy(
    // First argument is an object with client ID, client secret and callback URL.
    googleConfigs,
    // Second argument is a callback function to process authentication completion.
    afterGoogleSignin
  );

  // Configuring PassportJS Google OAuth 2.0 strategy on PassportJS instance
  passport.use(strategy);

  return passport.initialize();
}

module.exports = initGooglePassport;
