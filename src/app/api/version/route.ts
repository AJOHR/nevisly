/** Public build identity only; never return configuration or credentials. */
export function GET() {
  return Response.json({commit:process.env.VERCEL_GIT_COMMIT_SHA ?? 'local',model:'stage5'}, {headers:{'Cache-Control':'no-store'}});
}
