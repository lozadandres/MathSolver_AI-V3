import '../styles/Dashboards.css';

const TablePagination = ({ pagination, selected = 0, label = 'row(s)', className = '' }) => {
    if (!pagination) return null;

    const { page, pageSize, totalItems, totalPages, canPrevious, canNext, previousPage, nextPage } = pagination;
    const start = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
    const end = Math.min(page * pageSize, totalItems);

    return (
        <div className={`table-pagination ${className}`}>
            <span>
                {selected} of {Math.min(pageSize, totalItems)} {label} selected.
                {totalItems > 0 && <span className="pagination-range"> Mostrando {start}-{end} de {totalItems}</span>}
            </span>
            <div className="pagination-actions">
                <button type="button" className="action-btn" onClick={previousPage} disabled={!canPrevious}>
                    Previous
                </button>
                <button type="button" className="action-btn" onClick={nextPage} disabled={!canNext}>
                    Next
                </button>
            </div>
            {totalPages > 1 && <span className="pagination-page">Pagina {page} de {totalPages}</span>}
        </div>
    );
};

export default TablePagination;
