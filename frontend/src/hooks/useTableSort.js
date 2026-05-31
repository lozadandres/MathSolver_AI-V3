import { useMemo, useState } from 'react';

const normalizeValue = (value) => {
    if (value === null || value === undefined) return '';
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'number') return value;
    if (typeof value === 'boolean') return value ? 1 : 0;

    const asDate = Date.parse(value);
    if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(asDate) && /\d{4}-\d{2}-\d{2}|T\d{2}:/i.test(value)) {
        return asDate;
    }

    return String(value).toLocaleLowerCase();
};

const useTableSort = (items = [], initialKey = '', initialDirection = 'asc', accessors = {}) => {
    const [sortConfig, setSortConfig] = useState({ key: initialKey, direction: initialDirection });

    const requestSort = (key) => {
        setSortConfig((current) => ({
            key,
            direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const sortedItems = useMemo(() => {
        if (!sortConfig.key) return items;

        const getValue = accessors[sortConfig.key] || ((item) => item?.[sortConfig.key]);
        const direction = sortConfig.direction === 'desc' ? -1 : 1;

        return [...items].sort((a, b) => {
            const first = normalizeValue(getValue(a));
            const second = normalizeValue(getValue(b));

            if (first < second) return -1 * direction;
            if (first > second) return 1 * direction;
            return 0;
        });
    }, [items, accessors, sortConfig]);

    return {
        sortedItems,
        sortKey: sortConfig.key,
        direction: sortConfig.direction,
        requestSort
    };
};

export default useTableSort;
