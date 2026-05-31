import { useEffect, useMemo, useState } from 'react';

const usePagination = (items = [], pageSize = 5, resetKey = '') => {
    const [page, setPage] = useState(1);
    const totalItems = items.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

    useEffect(() => {
        setPage(1);
    }, [totalItems, pageSize, resetKey]);

    useEffect(() => {
        if (page > totalPages) setPage(totalPages);
    }, [page, totalPages]);

    const pageItems = useMemo(() => {
        const start = (page - 1) * pageSize;
        return items.slice(start, start + pageSize);
    }, [items, page, pageSize]);

    return {
        page,
        setPage,
        pageItems,
        pageSize,
        totalItems,
        totalPages,
        canPrevious: page > 1,
        canNext: page < totalPages,
        previousPage: () => setPage((current) => Math.max(1, current - 1)),
        nextPage: () => setPage((current) => Math.min(totalPages, current + 1))
    };
};

export default usePagination;
