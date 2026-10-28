const requestIdPattern =
  /^req_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createRequestId(request?: Request) {
  const supplied = request?.headers.get("x-request-id")?.trim();
  if (supplied && requestIdPattern.test(supplied)) return supplied;
  return `req_${crypto.randomUUID()}`;
}
