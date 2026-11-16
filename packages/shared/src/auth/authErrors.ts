import type { ApiError } from '../api/client';

export type AuthField = 'email' | 'password' | 'name';

// What a form should show for a failed login/register request.
export type AuthFeedback = {
  // Shown in an alert near the submit button.
  formMessage?: string;
  // Shown under the named fields.
  fieldErrors: Partial<Record<AuthField, string>>;
  // The field to move keyboard focus to, so a screen reader reads its error.
  focus?: AuthField;
  // Offer a "Log in instead" link (the email already has an account).
  offerLogin?: boolean;
};

const NETWORK = "Can't reach the server. Check your connection and try again.";
const GENERIC = 'Something went wrong. Please try again.';

// The server reports validation failures as one string: "email: <message>; password: <message>". The messages are
// technical ("Too small: expected string to have >=1 characters"), so they are never shown; only which fields were
// named is used. This can only happen if the client's rules drifted from the server's (see check:schema-parity).
// The order is the order the fields appear on the Register page (the Login page simply has no name field), because the
// first one in this list is where keyboard focus goes: it must be the first problem a person meets, reading top to bottom.
const AUTH_FIELDS: readonly AuthField[] = ['name', 'email', 'password'];

function fieldsNamedIn(serverMessage: string): AuthField[] {
  const named = serverMessage.split('; ').map((part) => part.split(': ', 1)[0]);
  return AUTH_FIELDS.filter((field) => named.includes(field));
}

// Takes an ApiError (the caller checks `instanceof ApiError` and re-throws anything else, so real bugs stay visible).
export function describeAuthError(error: ApiError): AuthFeedback {
  switch (error.code) {
    case 'INVALID_CREDENTIALS':
      // Deliberately does not say whether the email or the password was wrong; the server doesn't either.
      return { formMessage: 'Incorrect email or password.', fieldErrors: {} };

    case 'EMAIL_TAKEN':
      return {
        fieldErrors: { email: 'An account with this email already exists.' },
        focus: 'email',
        offerLogin: true,
      };

    case 'VALIDATION_ERROR': {
      const fields = fieldsNamedIn(error.message);
      if (fields.length === 0) {
        return { formMessage: 'Please check your details and try again.', fieldErrors: {} };
      }
      return {
        formMessage: "Some details weren't accepted. Please check the highlighted fields.",
        fieldErrors: Object.fromEntries(fields.map((field) => [field, "This wasn't accepted. Please check it."])),
        focus: fields[0],
      };
    }

    case 'NETWORK_ERROR':
      return { formMessage: NETWORK, fieldErrors: {} };

    default:
      // INTERNAL_ERROR, HTTP_ERROR, BAD_RESPONSE, INVALID_JSON, PAYLOAD_TOO_LARGE, and anything unforeseen.
      return { formMessage: GENERIC, fieldErrors: {} };
  }
}
