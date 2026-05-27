export interface UserInfoRecord {
  employeeNo: string;
  name: string;
  userType: 'normal' | 'admin' | 'visitor';
  floorNumber?: number;
  roomNumber?: number;
  Valid: {
    enable: boolean;
    beginTime: string;
    endTime: string;
  };
}

export interface UserInfoRequest {
  UserInfo: UserInfoRecord;
}

export function buildUserInfoPayload(params: {
  codigoFacial: number;
  nome: string;
  sufixo?: string;
  floorNo?: number;
  roomNo?: number;
  endTime?: string;
  userType?: 'normal' | 'visitor';
}): UserInfoRequest {
  const { codigoFacial, nome, sufixo = '', floorNo = 0, roomNo = 0, endTime, userType = 'normal' } = params;
  return {
    UserInfo: {
      employeeNo: String(codigoFacial),
      name: `${nome}${sufixo}`.slice(0, 32),
      userType,
      floorNumber: floorNo,
      roomNumber: roomNo,
      Valid: {
        enable: true,
        beginTime: '2000-01-01T00:00:00',
        endTime: endTime ?? '2037-12-31T23:59:59',
      },
    },
  };
}
