"""
GLB to 3MF conversion using trimesh.

Converts Meshy-generated GLB files to printer-ready 3MF format.
"""
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import httpx
import numpy as np
import trimesh


@dataclass
class ModelDimensions:
    """Model bounding box dimensions in mm."""
    width: float   # X axis
    depth: float   # Y axis
    height: float  # Z axis
    
    @property
    def max_dimension(self) -> float:
        return max(self.width, self.depth, self.height)
    
    def to_dict(self) -> dict:
        return {
            "width_mm": round(self.width, 2),
            "depth_mm": round(self.depth, 2),
            "height_mm": round(self.height, 2)
        }


@dataclass
class ConversionResult:
    """Result of GLB to 3MF conversion."""
    output_path: Path
    dimensions: ModelDimensions
    triangle_count: int
    is_watertight: bool
    warnings: list[str]


class ModelConverter:
    """
    Convert GLB models to print-ready 3MF format.
    
    Operations:
    1. Load GLB mesh
    2. Scale to target size
    3. Center on build plate
    4. Validate geometry
    5. Export as 3MF
    """
    
    # Bambu P1S build volume (mm)
    BUILD_PLATE_X = 256
    BUILD_PLATE_Y = 256
    BUILD_PLATE_Z = 256
    
    def __init__(self):
        self.warnings: list[str] = []
    
    async def download_model(self, url: str) -> Path:
        """Download GLB model from URL to temp file."""
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.get(url)
            response.raise_for_status()
            
            temp_file = tempfile.NamedTemporaryFile(
                suffix=".glb",
                delete=False
            )
            temp_file.write(response.content)
            temp_file.close()
            
            return Path(temp_file.name)
    
    def load_glb(self, path: Path) -> trimesh.Trimesh:
        """
        Load GLB file and extract mesh.
        
        GLB files can contain scenes with multiple meshes.
        We combine them into a single mesh for printing.
        """
        scene = trimesh.load(str(path))
        
        if isinstance(scene, trimesh.Scene):
            # Combine all meshes in scene
            meshes = []
            for name, geometry in scene.geometry.items():
                if isinstance(geometry, trimesh.Trimesh):
                    meshes.append(geometry)
            
            if not meshes:
                raise ValueError("No valid meshes found in GLB")
            
            mesh = trimesh.util.concatenate(meshes)
        elif isinstance(scene, trimesh.Trimesh):
            mesh = scene
        else:
            raise ValueError(f"Unexpected type: {type(scene)}")
        
        return mesh
    
    def get_dimensions(self, mesh: trimesh.Trimesh) -> ModelDimensions:
        """Get mesh bounding box dimensions."""
        bounds = mesh.bounds
        size = bounds[1] - bounds[0]
        
        return ModelDimensions(
            width=float(size[0]),
            depth=float(size[1]),
            height=float(size[2])
        )
    
    def scale_to_size(
        self,
        mesh: trimesh.Trimesh,
        target_size_mm: float,
        dimension: str = "max"
    ) -> trimesh.Trimesh:
        """
        Scale mesh so target dimension equals target_size_mm.
        
        Args:
            mesh: Input mesh
            target_size_mm: Desired size in millimeters
            dimension: Which dimension to target ("max", "height", "width", "depth")
        """
        dims = self.get_dimensions(mesh)
        
        if dimension == "max":
            current = dims.max_dimension
        elif dimension == "height":
            current = dims.height
        elif dimension == "width":
            current = dims.width
        elif dimension == "depth":
            current = dims.depth
        else:
            raise ValueError(f"Unknown dimension: {dimension}")
        
        if current == 0:
            raise ValueError("Mesh has zero size")
        
        scale_factor = target_size_mm / current
        mesh.apply_scale(scale_factor)
        
        return mesh
    
    def center_on_build_plate(self, mesh: trimesh.Trimesh) -> trimesh.Trimesh:
        """Center mesh on build plate with bottom at Z=0."""
        bounds = mesh.bounds
        
        center_x = (bounds[0][0] + bounds[1][0]) / 2
        center_y = (bounds[0][1] + bounds[1][1]) / 2
        min_z = bounds[0][2]
        
        translation = [
            self.BUILD_PLATE_X / 2 - center_x,
            self.BUILD_PLATE_Y / 2 - center_y,
            -min_z
        ]
        
        mesh.apply_translation(translation)
        return mesh
    
    def validate_printability(self, mesh: trimesh.Trimesh) -> list[str]:
        """Check mesh for common printing issues."""
        warnings = []
        
        if not mesh.is_watertight:
            warnings.append("Mesh is not watertight - may have holes")
        
        if mesh.is_winding_consistent is False:
            warnings.append("Inconsistent face winding - normals may be inverted")
        
        dims = self.get_dimensions(mesh)
        min_dim = min(dims.width, dims.depth, dims.height)
        if min_dim < 1.0:
            warnings.append(f"Very thin dimension ({min_dim:.2f}mm) - may not print well")
        
        if dims.width > self.BUILD_PLATE_X:
            warnings.append(f"Model too wide ({dims.width:.1f}mm > {self.BUILD_PLATE_X}mm)")
        if dims.depth > self.BUILD_PLATE_Y:
            warnings.append(f"Model too deep ({dims.depth:.1f}mm > {self.BUILD_PLATE_Y}mm)")
        if dims.height > self.BUILD_PLATE_Z:
            warnings.append(f"Model too tall ({dims.height:.1f}mm > {self.BUILD_PLATE_Z}mm)")
        
        if mesh.faces.shape[0] > 500000:
            warnings.append(f"High triangle count ({mesh.faces.shape[0]}) - consider simplifying")
        
        return warnings
    
    def repair_mesh(self, mesh: trimesh.Trimesh) -> trimesh.Trimesh:
        """Attempt to repair common mesh issues."""
        if not mesh.is_watertight:
            trimesh.repair.fill_holes(mesh)
        
        trimesh.repair.fix_winding(mesh)
        trimesh.repair.fix_normals(mesh)
        mesh.remove_degenerate_faces()
        mesh.remove_duplicate_faces()
        
        return mesh
    
    def export_3mf(self, mesh: trimesh.Trimesh, output_path: Path):
        """Export mesh as 3MF file."""
        mesh.export(str(output_path), file_type="3mf")
    
    async def convert(
        self,
        glb_url: str,
        output_path: Path,
        target_size_mm: float = 150.0,
        auto_repair: bool = True
    ) -> ConversionResult:
        """
        Complete conversion pipeline.
        
        Args:
            glb_url: URL to GLB file (from Meshy)
            output_path: Where to save 3MF
            target_size_mm: Target size for largest dimension
            auto_repair: Attempt to fix mesh issues
        
        Returns:
            ConversionResult with dimensions and warnings
        """
        self.warnings = []
        
        # Download GLB
        glb_path = await self.download_model(glb_url)
        
        try:
            # Load mesh
            mesh = self.load_glb(glb_path)
            
            # Repair if requested
            if auto_repair:
                mesh = self.repair_mesh(mesh)
            
            # Scale to target size
            mesh = self.scale_to_size(mesh, target_size_mm)
            
            # Center on build plate
            mesh = self.center_on_build_plate(mesh)
            
            # Validate
            warnings = self.validate_printability(mesh)
            self.warnings.extend(warnings)
            
            # Get final dimensions
            dimensions = self.get_dimensions(mesh)
            
            # Export
            self.export_3mf(mesh, output_path)
            
            return ConversionResult(
                output_path=output_path,
                dimensions=dimensions,
                triangle_count=mesh.faces.shape[0],
                is_watertight=mesh.is_watertight,
                warnings=self.warnings
            )
        
        finally:
            # Clean up temp file
            glb_path.unlink(missing_ok=True)


def estimate_print_time_minutes(
    volume_mm3: float,
    height_mm: float,
    infill_percent: float = 15,
    layer_height_mm: float = 0.2
) -> int:
    """
    Rough print time estimation.
    
    Based on typical P1S speeds. This is approximate.
    """
    layers = height_mm / layer_height_mm
    volume_per_layer = volume_mm3 / layers if layers > 0 else 0
    
    avg_speed_mm_per_sec = 100
    perimeter_per_layer = (volume_per_layer ** 0.5) * 4 if volume_per_layer > 0 else 0
    time_per_layer_sec = perimeter_per_layer / avg_speed_mm_per_sec
    
    infill_factor = 1 + (infill_percent / 100)
    time_per_layer_sec *= infill_factor
    
    total_seconds = layers * time_per_layer_sec * 1.3
    total_seconds += 300  # 5 min overhead
    
    return max(10, int(total_seconds / 60))


def inches_to_mm(inches: float) -> float:
    """Convert inches to millimeters."""
    return inches * 25.4


def mm_to_inches(mm: float) -> float:
    """Convert millimeters to inches."""
    return mm / 25.4
