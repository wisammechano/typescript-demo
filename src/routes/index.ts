import { Router } from 'express';
import authRoutes from './auth';
import todosRoutes from './todos';

const routes = Router();

routes.use('/auth', authRoutes);
routes.use('/todos', todosRoutes);

export default routes;
