import crypto from 'crypto';

export const etagCreater = (data) => {
    // Create an MD5 hash of the data
    return crypto.createHash('md5').update(data).digest('hex');
};
