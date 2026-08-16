const SECRET_KEY =
  /^(password|passwd|userpassword|ownerpassword|secret|privatekey|private_key|p12|pfx|redacttext|searchtext|cert|pin)$/i;

const PERSONAL_META_KEYS =
  /^(author|title|subject|keywords|creator|producer)$/i;

export function stripSecretsFromParams(
  params: Record<string, unknown>
): Record<string, unknown> {
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params || {})) {
    if (SECRET_KEY.test(key) || PERSONAL_META_KEYS.test(key)) continue;
    if (
      typeof value === 'string' &&
      (value.includes('%PDF') || value.includes('-----BEGIN'))
    ) {
      continue;
    }
    if (value instanceof Uint8Array) continue;
    next[key] = value;
  }
  return next;
}

export function assertRecipePrivacy(json: string): string[] {
  const errors: string[] = [];
  if (json.includes('%PDF')) errors.push('Recipe contains PDF bytes.');
  if (json.includes('-----BEGIN')) errors.push('Recipe contains key material.');
  try {
    const parsed = JSON.parse(json) as {
      steps?: Array<{ params?: Record<string, unknown> }>;
    };
    for (const step of parsed.steps || []) {
      for (const key of Object.keys(step.params || {})) {
        if (SECRET_KEY.test(key)) {
          errors.push(
            'Passwords and redaction text must not be stored in recipe JSON.'
          );
        }
        if (PERSONAL_META_KEYS.test(key) && step.params?.[key]) {
          errors.push(
            'Personal metadata fields must not be stored in recipe JSON.'
          );
        }
      }
    }
  } catch {
    errors.push('Recipe JSON is not valid.');
  }
  return errors;
}

export function serializeRecipe(data: unknown): string {
  const json = JSON.stringify(data);
  const errors = assertRecipePrivacy(json);
  if (errors.length) {
    throw new Error(errors[0]);
  }
  return json;
}
