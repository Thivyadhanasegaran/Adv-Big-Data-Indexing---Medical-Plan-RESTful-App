import { OAuth2Client } from 'google-auth-library';


const oauthClient = new OAuth2Client("759482205902-og06fbcd0tmuro8kjrrn3oqdslg682vb.apps.googleusercontent.com"); 

/**
 * Middleware to verify Google ID token
*/
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
        // Verify the ID token
        const ticket = await oauthClient.verifyIdToken({
            idToken: token,
            audience: oauthClient._clientId 
        });
        const payload = ticket.getPayload(); 
        req.user = payload; 
        next(); 
    } catch (err) {
        if (err.message.includes("Token used too late")) {
            console.error("Token expired:", err);
            return res.status(401).json({ message: 'Token expired. Please log in again.' });
        }
        console.error("Token verification error:", err);
        return res.status(401).json({ message: 'Unauthorized access', error: err.message });
    }
};

export default verifyToken;
