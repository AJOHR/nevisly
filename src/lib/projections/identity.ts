/** Provisional identity until a provider/Yahoo ID is available. Collisions must be rejected, not guessed. */
const identityAliases: Record<string,string> = {
  alexeitoropchenko:'alexeytoropchenko',
  maximshabanov:'maxshabanov',
  gabrielperreault:'gabeperreault',
  anthonydeangelo:'tonydeangelo',
  williamborgen:'willborgen',
  matthewboldy:'mattboldy',
  josephveleno:'joeveleno',
  alexanderovechkin:'alexovechkin',
  alexnikishin:'alexandernikishin',
  michaelmatheson:'mikematheson',
  jacobmiddleton:'jakemiddleton',
  alexromanov:'alexanderromanov',
  alexcarrier:'alexandrecarrier',
  nickrobertson:'nicholasrobertson',
  alextexier:'alexandretexier',
  michaelanderson:'mikeyanderson',
  thomasnovak:'tommynovak',
  emilmartinsenlilleberg:'emillilleberg',
  janismoser:'jjmoser',
  vincenthinostroza:'vinniehinostroza',
  maxwellcrozier:'maxcrozier',
  alexholtz:'alexanderholtz',
  yegorchinakhov:'egorchinakhov',
  matthewbeniers:'mattybeniers',
  alexwennberg:'alexanderwennberg',
  alexanderkerfoot:'alexkerfoot',
  zacharybolduc:'zackbolduc',
  // Vancouver has two different Elias Petterssons. Provider suffixes are
  // canonicalized without merging the defenseman into the centre.
  eliaspetterssonvanc:'eliaspettersson',
  eliaspetterssonvand:'eliaspetterssond',
};

export function normalizePlayerName(name: string): string {
  const normalized=name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return identityAliases[normalized] ?? normalized;
}
export function projectionId(name: string): string { return `projection:${normalizePlayerName(name)}`; }
