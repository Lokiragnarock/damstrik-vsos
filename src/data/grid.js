export const ROAD_NODES = {
    'SonySignal': { lat: 12.9450, lng: 77.6250, id: 'SonySignal', name: 'Sony World Signal' },
    'ChristUniv': { lat: 12.9360, lng: 77.6050, id: 'ChristUniv', name: 'Christ University' },
    'MadiwalaMkt': { lat: 12.9220, lng: 77.6180, id: 'MadiwalaMkt', name: 'Madiwala Market' },
    'Koramangala5th': { lat: 12.9340, lng: 77.6200, id: 'Koramangala5th', name: 'Koramangala 5th Block' },
    'ForumMall': { lat: 12.9350, lng: 77.6100, id: 'ForumMall', name: 'Forum Mall' },
    'StJohns': { lat: 12.9300, lng: 77.6200, id: 'StJohns', name: 'St. Johns Signal' }, // Central Hub
    'DairyCircle': { lat: 12.9380, lng: 77.6000, id: 'DairyCircle', name: 'Dairy Circle' },
    'BTMJunction': { lat: 12.9150, lng: 77.6100, id: 'BTMJunction', name: 'BTM Junction' },
    'Indiranagar100ft': { lat: 12.9600, lng: 77.6400, id: 'Indiranagar100ft', name: 'Indiranagar 100ft' },
    'WiproPark': { lat: 12.9320, lng: 77.6300, id: 'WiproPark', name: 'Wipro Park' },
    'Koramangala80ft': { lat: 12.9400, lng: 77.6200, id: 'Koramangala80ft', name: '80ft Road' },
    'JyotiNivas': { lat: 12.9330, lng: 77.6150, id: 'JyotiNivas', name: 'Jyoti Nivas College' },
    'CheckPost': { lat: 12.9250, lng: 77.6250, id: 'CheckPost', name: 'Check Post' }
};

export const ROAD_EDGES = [
    ['SonySignal', 'StJohns'],
    ['SonySignal', 'Indiranagar100ft'],
    ['ChristUniv', 'StJohns'],
    ['ChristUniv', 'DairyCircle'],
    ['ChristUniv', 'BTMJunction'],
    ['MadiwalaMkt', 'StJohns'],
    ['MadiwalaMkt', 'BTMJunction'],
    ['Koramangala5th', 'StJohns'],
    ['Koramangala5th', 'ForumMall'],
    ['DairyCircle', 'ForumMall'],
    ['StJohns', 'Indiranagar100ft']
];

export const ROAD_WAYPOINTS = {
    'SonySignal-StJohns': [{ lat: 12.9400, lng: 77.6240 }, { lat: 12.9350, lng: 77.6230 }],
    'StJohns-SonySignal': [{ lat: 12.9350, lng: 77.6230 }, { lat: 12.9400, lng: 77.6240 }],
    'SonySignal-Indiranagar100ft': [{ lat: 12.9500, lng: 77.6300 }, { lat: 12.9550, lng: 77.6350 }],
    'Indiranagar100ft-SonySignal': [{ lat: 12.9550, lng: 77.6350 }, { lat: 12.9500, lng: 77.6300 }],
    'StJohns-CheckPost': [{ lat: 12.9280, lng: 77.6220 }],
    'CheckPost-StJohns': [{ lat: 12.9280, lng: 77.6220 }],
    'MadiwalaMkt-StJohns': [{ lat: 12.9250, lng: 77.6190 }],
    'StJohns-MadiwalaMkt': [{ lat: 12.9250, lng: 77.6190 }]
};

export const ZONES = [
    { id: 'z1', name: 'Koramangala 5th Block', lat: 12.934, lng: 77.62, risk: 'high', type: 'theft', radius: 300 },
    { id: 'z2', name: 'SG Palya (Christ Univ)', lat: 12.938, lng: 77.60, risk: 'medium', type: 'public_order', radius: 250 },
    { id: 'z3', name: 'Sony Signal', lat: 12.945, lng: 77.625, risk: 'low', type: 'traffic', radius: 200 },
    { id: 'z4', name: 'Madiwala Market', lat: 12.922, lng: 77.618, risk: 'high', type: 'assault', radius: 350 },
];
