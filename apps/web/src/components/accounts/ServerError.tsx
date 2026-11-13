// What the account function said, in the same notice pattern as FormCheck
// (DESIGN-GAPS G2): an icon tile plus the words, announced politely.
import { InfoV2 } from "@/components/v2/icons";

export function ServerError({ message }: { message: string | null }) {
  return (
    <p className="v2-notice v2-form-error" role="alert" data-testid="account-error">
      {message ? (
        <>
          <span className="v2-notice-icon">
            <InfoV2 />
          </span>
          <span>{message}</span>
        </>
      ) : null}
    </p>
  );
}
