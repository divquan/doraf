ALTER TABLE "session"
    DROP CONSTRAINT "session_authentication_strength_allowed";

ALTER TABLE "session"
    ADD CONSTRAINT "session_authentication_strength_allowed" CHECK (
        "authentication_strength" IN ('PRIMARY', 'MFA', 'OTP', 'PHISHING_RESISTANT')
    );
