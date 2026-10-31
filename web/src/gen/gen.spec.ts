import { AdminService } from './kantahe/v1/admin_pb';
import { AuthService } from './kantahe/v1/auth_pb';
import { CatalogService } from './kantahe/v1/catalog_pb';
import { SessionService } from './kantahe/v1/session_pb';
import { UploadService } from './kantahe/v1/upload_pb';
import { UserLibraryService } from './kantahe/v1/user_library_pb';

describe('generated contract', () => {
  it('exports all services', () => {
    const services = { AuthService, AdminService, UploadService, CatalogService, SessionService, UserLibraryService };
    for (const [name, service] of Object.entries(services)) {
      expect(service.typeName).toBe(`kantahe.v1.${name}`);
    }
  });
});
