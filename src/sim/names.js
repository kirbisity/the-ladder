// Names for simulated colleagues and companies.

export const FIRST_NAMES = [
  'Aisha', 'Ben', 'Carlos', 'Dana', 'Eli', 'Fatima', 'Grace', 'Hiro', 'Ines', 'Jamal',
  'Kara', 'Liam', 'Mei', 'Nadia', 'Omar', 'Priya', 'Quinn', 'Rosa', 'Sam', 'Tariq',
  'Uma', 'Victor', 'Wen', 'Ximena', 'Yusuf', 'Zoe', 'Arjun', 'Bea', 'Chen', 'Diego',
  'Erin', 'Felix', 'Gwen', 'Hassan', 'Ivy', 'Jonah', 'Keiko', 'Leon', 'Maria', 'Nate',
  'Olga', 'Pablo', 'Rhea', 'Sven', 'Tess', 'Ugo', 'Vera', 'Will', 'Yara', 'Zane',
];

export const LAST_NAMES = [
  'Adler', 'Brooks', 'Castillo', 'Dubois', 'Eriksen', 'Fischer', 'Garcia', 'Haddad', 'Ito', 'Jansen',
  'Kowalski', 'Larsen', 'Moreau', 'Nakamura', 'Okafor', 'Petrov', 'Quintero', 'Rossi', 'Singh', 'Tanaka',
  'Ueda', 'Varga', 'Wallace', 'Xu', 'Yilmaz', 'Zhang', 'Abbott', 'Bauer', 'Chowdhury', 'Diaz',
];

// Employers by industry and tier. Invented names, chosen to sound like the
// kind of firm each tier is.
export const COMPANY_NAMES = {
  tech: {
    aggressive: ['Vantage Systems', 'Kestrel AI', 'Orbitly', 'Hyperion Cloud', 'Northstar Labs'],
    mid: ['Brightwire', 'Parallax Systems', 'Quanta Cloud', 'Stackwell', 'Nimbus Software'],
    stable: ['Allied Data Corporation', 'Continental Software', 'Midland Systems Group', 'Keystone Enterprise IT', 'Harbor Insurance Technology'],
    startup: ['Fernlight', 'Pivotly', 'Thimble', 'Lumen Labs', 'Quillbase', 'Tandem.ai', 'Sproutstack'],
  },
  consulting: {
    aggressive: ['Hartley & Vance', 'Sterling Strategy Group', 'Ashford Partners'],
    mid: ['Meridian Partners', 'Crestline Advisory', 'Calder & Ross'],
    stable: ['Northgate Group', 'Harbor & Lane Consulting', 'Whitfield Advisory'],
    startup: ['Brightpath Advisory'],
  },
  privateEquity: {
    aggressive: ['Blackthorn Capital', 'Summit Ridge Partners', 'Granite Peak Capital'],
    mid: ['Ironbridge Equity', 'Argent Holdings', 'Westbrook Partners'],
    stable: ['Cedar Row Capital', 'Lakeshore Partners', 'Old Mill Equity'],
    startup: ['First Light Ventures'],
  },
  academia: {
    aggressive: ['Halvorsen Institute of Technology', 'Easton University', 'Carrow Institute'],
    mid: ['Lakemont University', 'Redfield State University', 'Ashbury University'],
    stable: ['Weller College', 'Brook Valley State', 'Saint Aldric College'],
    startup: ['Open Minerva Institute'],
  },
};

export const DIVISION_NAMES = {
  tech: ['Platform', 'Product', 'Data & AI', 'Infrastructure'],
  consulting: ['Strategy', 'Operations', 'Digital', 'Healthcare'],
  privateEquity: ['Buyouts', 'Growth Equity', 'Credit', 'Real Assets'],
  academia: ['Computer Science', 'Economics', 'Biology', 'Physics'],
};

export const TEAM_NAMES = {
  tech: ['Payments', 'Search', 'Identity', 'Mobile', 'Billing', 'Storage', 'Growth', 'Ads', 'Ranking'],
  consulting: ['Retail', 'Banking', 'Energy', 'Telecom', 'Pharma', 'Public Sector', 'Insurance', 'Media', 'Logistics'],
  privateEquity: ['Industrials', 'Consumer', 'Software', 'Healthcare', 'Fintech', 'Energy', 'Business Services', 'Media', 'Infra'],
  academia: ['Systems Lab', 'Theory Group', 'Vision Lab', 'Robotics', 'NLP Group', 'Security Lab', 'HCI Group', 'Graphics', 'Networks'],
};
