// Entry point: mount the interactive workbench into #app.
import './styles.css';
import { mountWorkbench } from './ui/workbench';

const root = document.getElementById('app');
if (root) mountWorkbench(root);
