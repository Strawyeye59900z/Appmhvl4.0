export interface UserInfoRecord {
  employeeNo: string;
  name: string;
  userType: 'normal' | 'admin' | 'visitor';
  Valid: {
    enable: boolean;
    beginTime: string;
    endTime: string;
  };
}

export interface UserInfoRequest {
  UserInfo: UserInfoRecord;
}

export function buildUserInfoPayload(id: string, nome: string): UserInfoRequest {
  return {
    UserInfo: {
      employeeNo: id,
      name: nome.slice(0, 32),
      userType: 'normal',
      Valid: {
        enable: true,
        beginTime: '2000-01-01T00:00:00',
        endTime: '2037-12-31T23:59:59',
      },
    },
  };
}
