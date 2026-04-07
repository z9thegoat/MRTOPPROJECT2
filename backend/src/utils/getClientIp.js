export const getClientIp = (req) => {
  const xForwardedFor = req.headers['x-forwarded-for'];
  if (xForwardedFor) {
    return xForwardedFor.split(',')[0].trim();
  }

  // fallback for direct connections
  return req.socket.remoteAddress.replace('::ffff:', '');
};