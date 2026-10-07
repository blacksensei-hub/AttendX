// server/src/utils/roles.js

/**
 * The roles anyone may pick when signing up. Admin accounts are made only
 * in the admin console, where an admin changes an account's role (bulk
 * import also creates only students and lecturers), never through the
 * public register endpoint: the sign-up form only offers these two, but
 * the server must not trust the form.
 */
const SIGNUP_ROLES = ['student', 'lecturer'];

/** The role to create, or null when the request asks for one it can't have. */
function signupRole(requested) {
  const role = requested ?? 'student';
  return SIGNUP_ROLES.includes(role) ? role : null;
}

module.exports = { SIGNUP_ROLES, signupRole };
