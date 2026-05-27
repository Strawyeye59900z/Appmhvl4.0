export function parseApartamento(numero: string): { floorNo: number; roomNo: number } {
  const n = numero.replace(/\D/g, '');
  if (!n) return { floorNo: 0, roomNo: 0 };
  if (n.length <= 3) {
    return { floorNo: parseInt(n.slice(0, 1), 10), roomNo: parseInt(n.slice(1), 10) };
  }
  return { floorNo: parseInt(n.slice(0, -2), 10), roomNo: parseInt(n.slice(-2), 10) };
}
// "901"  → { floorNo: 9,  roomNo: 1  }
// "1403" → { floorNo: 14, roomNo: 3  }
// ""     → { floorNo: 0,  roomNo: 0  }
