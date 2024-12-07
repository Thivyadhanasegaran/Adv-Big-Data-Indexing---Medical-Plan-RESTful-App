import { OAuth2Client } from 'google-auth-library';

const oauthClient = new OAuth2Client("759482205902-og06fbcd0tmuro8kjrrn3oqdslg682vb.apps.googleusercontent.com");

const verifyToken = async (req, res, next) => {
    // Check if authorization header exists
    if (!req.headers['authorization']) {
        return res.status(400).send('Authorization header missing');
    }

    // Check if the authorization header is in Bearer format
    const token = req.headers['authorization'].split(' ')[1];
    if (!token || req.headers['authorization'].split(' ')[0] !== 'Bearer') {
        return res.status(400).send('Invalid Bearer Token format');
    }

    try {
        // Verify the ID token using the built-in method from google-auth-library
        const ticket = await oauthClient.verifyIdToken({
            idToken: token,
            audience: oauthClient._clientId, 
        });

        const payload = ticket.getPayload(); 
        
        // Check if the token has expired by comparing `exp` with the current time
        const currentTime = Math.floor(Date.now() / 1000); 
        if (payload.exp && payload.exp < currentTime) {
            // If token is expired, return an error
            return res.status(401).json({ message: 'Token has expired. Please reauthenticate.' });
        }

        req.user = payload; // Attach user info to request
        next(); // Proceed to the next middleware or route handler
    } catch (err) {
        console.error("Token verification error:", err);

        // Specific error handling for expired token
        if (err.message.includes('Token used too late') || err.message.includes('invalid_token')) {
            return res.status(401).json({ message: 'Token expired. Please log in again.' });
        }

        // Generic Unauthorized error for other cases
        return res.status(401).json({ message: 'Unauthorized access', error: err.message });
    }
};

export default verifyToken;
