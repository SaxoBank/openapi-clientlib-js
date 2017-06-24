/* globals process */
const token = process.env.OPENAPI_ACCESSTOKEN;
if (token === 'undefined' || token === '') {
    throw new Error('Environment variable OPENAPI_ACCESSTOKEN is missing.');
}
const baseUrl = 'https://developer.saxobank.com/sim/openapi';

export { token, baseUrl };
