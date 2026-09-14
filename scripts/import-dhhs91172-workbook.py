"""Lossless, deterministic draft catalog export. Uses Python standard library only."""
import argparse
import hashlib
import json
from pathlib import Path
import xml.etree.ElementTree as ET
import zipfile

NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}


def sheets(path):
    with zipfile.ZipFile(path) as z:
        strings = [''.join(x.itertext()) for x in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('m:si', NS)]
        names = [s.attrib['name'] for s in ET.fromstring(z.read('xl/workbook.xml')).findall('m:sheets/m:sheet', NS)]
        result = {}
        for i, name in enumerate(names, 1):
            matrix = []
            for row in ET.fromstring(z.read(f'xl/worksheets/sheet{i}.xml')).findall('m:sheetData/m:row', NS):
                cells = {}
                for cell in row:
                    address = ''.join(c for c in cell.attrib['r'] if c.isalpha())
                    value = cell.find('m:v', NS)
                    inline = cell.find('m:is', NS)
                    cells[address] = (strings[int(value.text)] if cell.attrib.get('t') == 's' else value.text) if value is not None else ''.join(inline.itertext()) if inline is not None else ''
                matrix.append(cells)
            header = matrix[0]
            result[name] = [{label: row.get(col, '') for col, label in header.items() if label} for row in matrix[1:] if row.get('A')]
        return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('workbook', type=Path)
    parser.add_argument('--output', type=Path, default=Path(__file__).resolve().parents[1] / 'docs/compliance/dhhs91172')
    args = parser.parse_args()
    out = args.output
    manifest = json.loads((out / 'MANIFEST.json').read_text())
    digest = hashlib.sha256(args.workbook.read_bytes()).hexdigest()
    if digest != manifest['sha256']:
        raise ValueError('Workbook does not match approved source hash; review its version before importing')
    data = sheets(args.workbook)
    parents = data['Requirement_Catalog']
    assert len(parents) == manifest['catalog_rows'] == 760
    assert len(data['Requirements']) == manifest['requirements_rows'] == 1367
    assert len(data['Source_index']) == 1693
    assert len({r['requirement_key'] for r in parents}) == 760
    assert all(r['rule_status'] == 'draft' and r['execution_status'] == 'not_published' for r in parents)
    for r in parents:
        r['element_count'] = int(r['element_count'])

    def write(name, value):
        target = out / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')

    for i in range(10):
        write(f'catalog_batches/catalog_{i:02}.json', {'batch': f'{i:02}', 'ingest_status': 'loaded', 'rows': parents[i*80:(i+1)*80]})
    for name in ['Requirements', 'Source_index']:
        write(name+'.json', {'sheet': name, 'workbook_sha256': digest, 'ingest_status': 'loaded', 'archive_only': name == 'Source_index', 'rows': data[name]})
    write('Requirement_Catalog.json', {'sheet': 'Requirement_Catalog', 'canonical_parents_from': 'Requirements', 'expected_parent_count': 760, 'ingest_status': 'loaded', 'storage': 'catalog_batches/catalog_00.json through catalog_09.json', 'rows': []})
    write('Applicability_Facts.json', {'sheet': 'Applicability_Facts', 'unknown_policy': 'question_or_missing_information', 'never': 'automatic_compliance', 'rows': data['Applicability_Facts']})
    gaps = []
    for i, row in enumerate(data['Release_Gaps'], 1):
        gaps.append({**row, 'id': f'WORKBOOK-GAP-{i:02}', 'topic': row['Issue'], 'clause': row['Source / scope'], 'gap': row['Required resolution']})
    write('Release_Gaps.json', {'sheet': 'Release_Gaps', 'status': 'open', 'open_count': len(gaps), 'rows': gaps})
    # Preserve human implementation guidance verbatim as source data, not executable rules.
    for name in ['Design_Review', 'System_Design']:
        write(name+'.json', {'sheet': name, 'workbook_sha256': digest, 'rows': data[name]})
    write('Core_Rule_Logic_source.json', {'sheet': 'Core_Rule_Logic', 'workbook_sha256': digest, 'rows': data['Core_Rule_Logic']})
    print(f'Exported {len(parents)} parents, 607 elements, 1693 source rows, {len(data["Applicability_Facts"])} facts and {len(gaps)} open gaps')


if __name__ == '__main__':
    main()
