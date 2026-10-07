// server/src/utils/roles.js

/**
 * The roles anyone may pick when signing up. Admin accounts come only
 * from the admin console (bulk import, or a role change by an admin),
 * never from the public register endpoint: the sign-up form only offers
 * these two, but the server must not trust the form.
 */
const SIGNUP_ROLES = ['student', 'lecturer'];

/** The role to create, or null when the request asks for one it can't have. */
function signupRole(requested) {
  const role = requested ?? 'student';
  return SIGNUP_ROLES.includes(role) ? role : null;
}

module.exports = { SIGNUP_ROLES, signupRole };
