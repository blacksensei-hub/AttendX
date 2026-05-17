const success = (data, message = 'OK') => ({ success: true, message, ...data });
const error   = (message, code)         => ({ success: false, message, code });

module.exports = { success, error };