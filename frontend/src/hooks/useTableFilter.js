import { useMemo } from 'react';

const useTableFilter = (items = [], query = '', accessors = []) => {
    return useMemo(() => {
        const normalizedQuery = query.trim().toLocaleLowerCase();
        if (!normalizedQuery) return items;

        return items.filter((item) => accessors.some((getValue) => {
            const value = getValue(item);
            return String(value ?? '').toLocaleLowerCase().includes(normalizedQuery);
        }));
    }, [items, query, accessors]);
};

export default useTableFilter;
