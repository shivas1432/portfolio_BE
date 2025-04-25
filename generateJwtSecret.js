import crypto from 'crypto';

const generateJwtSecret = () => {
  const secretKey = crypto.randomBytes(64).toString('hex');
  return secretKey;
};

export { generateJwtSecret };
