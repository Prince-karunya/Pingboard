import { cap } from '../utils/helpers';

export default function PriorityBadge({ priority }) {
  const color = { urgent: 'danger', important: 'warning', normal: 'primary' }[priority];
  return <span className={'badge bg-' + color + (priority === 'important' ? ' text-dark' : '')}>{cap(priority)}</span>;
}
