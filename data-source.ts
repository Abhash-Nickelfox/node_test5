import { DataSource, DataSourceOptions } from 'typeorm';
import { User } from '@modules/users/entities/user.entity';
import { Role } from '@modules/users/entities/role.entity';
import { RefreshToken } from '@modules/auth/entities/refresh-token.entity';
import { FileUpload } from '@modules/uploads/entities/file-upload.entity';
import { Notification } from '@modules/notifications/entities/notification.entity';
import { InitialSchema1700000000000 } from './src/migrations/1700000000000-InitialSchema';

const dataSourceOptions: DataSourceOptions = {
  type: 'better-sqlite3',
  database: process.env.DATABASE_URL || './data/my_app.db',
  entities: [User, Role, RefreshToken, FileUpload, Notification],
  migrations: [InitialSchema1700000000000],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
};

const dataSource = new DataSource(dataSourceOptions);
export default dataSource;
