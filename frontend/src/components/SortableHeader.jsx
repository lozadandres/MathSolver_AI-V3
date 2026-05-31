import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';

const SortableHeader = ({ label, sortKey, sort, align = 'left' }) => {
    const active = sort?.sortKey === sortKey;
    const Icon = active ? (sort.direction === 'asc' ? ArrowUp : ArrowDown) : ChevronsUpDown;

    return (
        <th style={{ textAlign: align }}>
            <button
                type="button"
                className={`sortable-th-button ${active ? 'active' : ''}`}
                onClick={() => sort?.requestSort(sortKey)}
            >
                <span>{label}</span>
                <Icon size={15} />
            </button>
        </th>
    );
};

export default SortableHeader;
