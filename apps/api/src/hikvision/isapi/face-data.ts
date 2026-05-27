export interface FaceDataRecord {
  faceLibType: 'blackFD';
  FDID: '1';
  FPID: string;
}

export function buildFaceDataRecord(employeeNo: string): FaceDataRecord {
  return {
    faceLibType: 'blackFD',
    FDID: '1',
    FPID: employeeNo,
  };
}
